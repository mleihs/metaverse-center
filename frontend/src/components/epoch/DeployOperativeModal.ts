/**
 * Deploy Operative Modal — "The War Table" TCG redesign.
 *
 * Full-screen overlay with three zone slots (Asset → Mission → Target).
 * Agent card hand with fan geometry at bottom. Every choice is a card
 * laid down with fly + slam animations. Deploy sequence: charge → freeze
 * → release → stamp → close.
 *
 * Same properties/events contract as the previous modal — no changes
 * needed in EpochCommandCenter.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  agentsApi,
  buildingsApi,
  embassiesApi,
  epochsApi,
  locationsApi,
} from '../../services/api/index.js';
import type {
  Agent,
  AgentAptitude,
  AptitudeSet,
  Building,
  Embassy,
  OperativeMission,
  OperativeType,
  Zone,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { OPERATIVE_COLORS as OP_COLORS, OPERATIVE_RP_COSTS } from '../../utils/operative-constants.js';
import { focusFirstElement, trapFocus } from '../shared/focus-trap.js';
import '../shared/VelgGameCard.js';
import './MissionCard.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgAptitudeBars.js';
import { VelgToast } from '../shared/Toast.js';

// ── Types & Constants ────────────────────────────────

type Step = 'asset' | 'mission' | 'target';
type DeployPhase = 'idle' | 'charging' | 'frozen' | 'releasing' | 'resolved';

interface OperativeTypeInfo {
  type: OperativeType;
  cost: number;
  duration: string;
  effect: string;
  needsTarget: 'building' | 'agent' | 'embassy' | 'zone' | 'none';
}

function getOperativeTypes(): OperativeTypeInfo[] {
  return [
    {
      type: 'spy',
      cost: OPERATIVE_RP_COSTS.spy,
      duration: msg('3 cycles'),
      effect: msg('Reveals target health metrics, zone stability, and active operatives.'),
      needsTarget: 'none',
    },
    {
      type: 'saboteur',
      cost: OPERATIVE_RP_COSTS.saboteur,
      duration: msg('1 cycle deploy'),
      effect: msg('Degrades one target building condition by one step.'),
      needsTarget: 'building',
    },
    {
      type: 'propagandist',
      cost: OPERATIVE_RP_COSTS.propagandist,
      duration: msg('2 cycles'),
      effect: msg('Generates a destabilizing event (impact 6-8) in target zone.'),
      needsTarget: 'zone',
    },
    {
      type: 'assassin',
      cost: OPERATIVE_RP_COSTS.assassin,
      duration: msg('2 cycle deploy'),
      effect: msg('Wounds target agent — reduces relationships by 2, removes ambassador status.'),
      needsTarget: 'agent',
    },
    {
      type: 'infiltrator',
      cost: OPERATIVE_RP_COSTS.infiltrator,
      duration: msg('3 cycles'),
      effect: msg('Reduces target embassy effectiveness by 50% for 3 cycles.'),
      needsTarget: 'embassy',
    },
    {
      type: 'guardian',
      cost: OPERATIVE_RP_COSTS.guardian,
      duration: msg('Permanent'),
      effect: msg(
        'Detects hostile operatives entering your simulation. +15% counter-intel success.',
      ),
      needsTarget: 'none',
    },
  ];
}

@localized()
@customElement('velg-deploy-operative-modal')
export class VelgDeployOperativeModal extends LitElement {
  static styles = css`
		:host {
			display: block;
		}

		/* ══════════════════════════════════════════════════
		   OVERLAY — full-screen war table
		   ══════════════════════════════════════════════════ */
		.overlay {
			position: fixed;
			inset: 0;
			z-index: var(--z-top, 9000);
			background: var(--color-gray-950, #0a0a0f);
			display: flex;
			flex-direction: column;
			opacity: 0;
			animation: overlay-in 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
		}

		.overlay::after {
			content: '';
			position: fixed;
			inset: 0;
			pointer-events: none;
			background: repeating-linear-gradient(
				0deg, transparent, transparent 2px,
				rgba(255 255 255 / 0.012) 2px,
				rgba(255 255 255 / 0.012) 4px
			);
			z-index: 1;
		}

		@keyframes overlay-in {
			from { opacity: 0; }
			to { opacity: 1; }
		}

		/* ── Header ── */
		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: var(--space-3) var(--space-5);
			border-bottom: 2px solid var(--color-gray-800);
			background: var(--color-gray-900);
			flex-shrink: 0;
			z-index: 2;
		}

		.header__left {
			display: flex;
			align-items: center;
			gap: var(--space-3);
		}

		.header__title {
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: var(--text-lg);
			text-transform: uppercase;
			letter-spacing: var(--tracking-wide);
			color: var(--color-gray-100);
		}

		.header__subtitle {
			font-family: var(--font-mono, monospace);
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--color-gray-500);
		}

		.header__rp {
			display: inline-flex;
			align-items: center;
			gap: var(--space-1);
			padding: var(--space-1) var(--space-3);
			border: 1px solid rgba(245 158 11 / 0.4);
			background: rgba(245 158 11 / 0.08);
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: var(--text-sm);
			color: var(--color-epoch-accent, #f59e0b);
		}

		.header__close {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 36px;
			height: 36px;
			padding: 0;
			border: 1px solid var(--color-gray-700);
			background: transparent;
			color: var(--color-gray-400);
			cursor: pointer;
			transition: all 150ms ease;
		}

		.header__close:hover {
			border-color: var(--color-gray-400);
			color: var(--color-gray-100);
			background: var(--color-gray-800);
		}

		/* ══════════════════════════════════════════════════
		   WAR TABLE — central zone area
		   ══════════════════════════════════════════════════ */
		.table {
			flex: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			/* start, not center — prevents top clipping when content is taller than viewport */
			justify-content: flex-start;
			padding: var(--space-4) var(--space-5);
			overflow-y: auto;
			min-height: 0;
			z-index: 2;
			position: relative;
		}

		/* ── Three zone slots row ── */
		.zones {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			margin-bottom: var(--space-4);
		}

		/* ── Zone slot: tactical card dock ── */
		.zone {
			position: relative;
			width: 160px;
			height: 240px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			flex-shrink: 0;
			transition: all 200ms ease;
			/* Recessed bay surface */
			background:
				linear-gradient(180deg, rgba(0 0 0 / 0.4) 0%, rgba(0 0 0 / 0.15) 50%, rgba(0 0 0 / 0.35) 100%),
				var(--color-gray-950, #030712);
			border: 1px solid var(--color-gray-800, #1f2937);
			box-shadow:
				inset 0 2px 8px rgba(0 0 0 / 0.6),
				inset 0 0 1px rgba(255 255 255 / 0.03),
				0 1px 0 rgba(255 255 255 / 0.02);
		}

		/* Corner bracket targeting marks */
		.zone::before,
		.zone::after {
			content: '';
			position: absolute;
			inset: 6px;
			pointer-events: none;
			z-index: 1;
			transition: opacity 300ms ease;
		}

		.zone::before {
			background:
				linear-gradient(to right, var(--zone-bracket, var(--color-gray-600, #4b5563)) 0%, transparent 100%) no-repeat 0 0 / 18px 1px,
				linear-gradient(to bottom, var(--zone-bracket, var(--color-gray-600, #4b5563)) 0%, transparent 100%) no-repeat 0 0 / 1px 18px,
				linear-gradient(to left, var(--zone-bracket, var(--color-gray-600, #4b5563)) 0%, transparent 100%) no-repeat 100% 100% / 18px 1px,
				linear-gradient(to top, var(--zone-bracket, var(--color-gray-600, #4b5563)) 0%, transparent 100%) no-repeat 100% 100% / 1px 18px;
		}

		.zone::after {
			background:
				linear-gradient(to left, var(--zone-bracket, var(--color-gray-600, #4b5563)) 0%, transparent 100%) no-repeat 100% 0 / 18px 1px,
				linear-gradient(to bottom, var(--zone-bracket, var(--color-gray-600, #4b5563)) 0%, transparent 100%) no-repeat 100% 0 / 1px 18px,
				linear-gradient(to right, var(--zone-bracket, var(--color-gray-600, #4b5563)) 0%, transparent 100%) no-repeat 0 100% / 18px 1px,
				linear-gradient(to top, var(--zone-bracket, var(--color-gray-600, #4b5563)) 0%, transparent 100%) no-repeat 0 100% / 1px 18px;
		}

		/* Empty: awaiting card */
		.zone--empty {
			--zone-bracket: color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 40%, var(--color-gray-600));
			animation: slot-breathe 2.5s ease-in-out infinite alternate;
		}

		/* Filled: card docked */
		.zone--filled {
			border-color: transparent;
			background: transparent;
			box-shadow: none;
			animation: zone-slam 400ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
			transition:
				transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
				filter 200ms ease;
		}

		.zone--filled:hover {
			z-index: 15;
			transform: scale(1.2) translateY(-12px) !important;
			filter:
				drop-shadow(0 0 16px rgba(245 158 11 / 0.3))
				drop-shadow(0 20px 40px rgba(0 0 0 / 0.7));
		}

		.zone--filled::before,
		.zone--filled::after {
			opacity: 0;
		}

		/* Locked: powered-down bay */
		.zone--locked {
			border-color: var(--color-gray-900, #111827);
			background:
				repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255 255 255 / 0.008) 4px, rgba(255 255 255 / 0.008) 5px),
				linear-gradient(180deg, rgba(0 0 0 / 0.5), rgba(0 0 0 / 0.3)),
				var(--color-gray-950, #030712);
			box-shadow: inset 0 2px 12px rgba(0 0 0 / 0.7);
			animation: none;
		}

		.zone--locked::before,
		.zone--locked::after {
			--zone-bracket: var(--color-gray-800, #1f2937);
			opacity: 0.4;
		}

		.zone--locked .zone__label {
			color: var(--color-gray-700, #374151);
		}

		/* Active-target: pulsing amber energy */
		.zone--active-target {
			--zone-bracket: var(--color-epoch-accent, #f59e0b);
			border-color: var(--color-epoch-accent, #f59e0b);
			border-style: solid;
			animation: zone-pulse 1.5s ease-in-out infinite;
		}

		.zone--dragover {
			border-color: var(--color-epoch-accent, #f59e0b);
			border-style: solid;
			box-shadow: 0 0 16px rgba(245 158 11 / 0.2), inset 0 0 12px rgba(245 158 11 / 0.06);
			transform: scale(1.03);
			transition: all 150ms ease;
		}

		/* ── Counter pips ── */
		.counter-pips {
			display: flex;
			justify-content: center;
			gap: 12px;
			padding: var(--space-2) 0;
			z-index: 2;
		}

		.counter-pip {
			width: 10px;
			height: 10px;
			border-radius: 50%;
			border: 1.5px solid var(--color-gray-600);
			background: transparent;
			transition: all 200ms ease;
		}

		.counter-pip--filled {
			border-color: var(--color-epoch-accent, #f59e0b);
			background: var(--color-epoch-accent, #f59e0b);
			animation: pip-flip 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
		}

		@keyframes pip-flip {
			0% { transform: scale(0.3) rotateY(90deg); }
			50% { transform: scale(1.3) rotateY(0deg); }
			100% { transform: scale(1) rotateY(0deg); }
		}

		@keyframes slot-breathe {
			from {
				border-color: var(--color-gray-800, #1f2937);
				box-shadow:
					inset 0 2px 8px rgba(0 0 0 / 0.6),
					inset 0 0 1px rgba(255 255 255 / 0.03),
					0 1px 0 rgba(255 255 255 / 0.02);
			}
			to {
				border-color: color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 25%, var(--color-gray-700));
				box-shadow:
					inset 0 2px 8px rgba(0 0 0 / 0.6),
					inset 0 0 12px rgba(245 158 11 / 0.04),
					0 0 8px rgba(245 158 11 / 0.06),
					0 1px 0 rgba(255 255 255 / 0.02);
			}
		}

		@keyframes zone-slam {
			0% { transform: scale(1.15); }
			20% { transform: scale(0.92); }
			60% { transform: scale(1.04); }
			100% { transform: scale(1); }
		}

		@keyframes zone-pulse {
			0%, 100% {
				box-shadow:
					inset 0 2px 8px rgba(0 0 0 / 0.6),
					inset 0 0 20px rgba(245 158 11 / 0.06),
					0 0 0 0 rgba(245 158 11 / 0.3);
			}
			50% {
				box-shadow:
					inset 0 2px 8px rgba(0 0 0 / 0.6),
					inset 0 0 30px rgba(245 158 11 / 0.1),
					0 0 24px 4px rgba(245 158 11 / 0.12);
			}
		}

		/* Zone label: military stencil */
		.zone__label {
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.2em;
			color: var(--color-gray-500, #6b7280);
			margin-bottom: var(--space-1);
			text-shadow: 0 1px 2px rgba(0 0 0 / 0.5);
		}

		.zone__hint {
			font-family: var(--font-mono, monospace);
			font-size: 9px;
			color: var(--color-gray-600, #4b5563);
			text-align: center;
			padding: 0 var(--space-2);
			opacity: 0.7;
		}

		/* Card silhouette inside empty zone */
		.zone__silhouette {
			position: absolute;
			inset: 14px;
			pointer-events: none;
			opacity: 0.06;
		}

		.zone__silhouette-frame {
			width: 100%;
			height: 100%;
			border: 2px solid currentColor;
			border-radius: 6px;
			position: relative;
		}

		/* Art area placeholder */
		.zone__silhouette-frame::before {
			content: '';
			position: absolute;
			top: 8px;
			left: 8px;
			right: 8px;
			height: 55%;
			border: 1px solid currentColor;
			border-radius: 3px;
		}

		/* Name plate placeholder */
		.zone__silhouette-frame::after {
			content: '';
			position: absolute;
			bottom: 30%;
			left: 12px;
			right: 12px;
			height: 12px;
			background: currentColor;
			border-radius: 2px;
			opacity: 0.5;
		}

		.zone--empty .zone__silhouette {
			opacity: 0.08;
			color: var(--color-epoch-accent, #f59e0b);
		}

		.zone--locked .zone__silhouette {
			opacity: 0.03;
		}

		.zone__remove {
			position: absolute;
			top: 8px;
			right: 8px;
			width: 22px;
			height: 22px;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0;
			border: 1px solid var(--color-gray-600);
			border-radius: 50%;
			background: var(--color-gray-900);
			color: var(--color-gray-400);
			cursor: pointer;
			opacity: 0;
			transition: all 150ms ease;
			z-index: 5;
		}

		.zone--filled:hover .zone__remove {
			opacity: 1;
		}

		.zone__remove:hover {
			border-color: var(--color-danger);
			color: var(--color-danger);
			background: var(--color-gray-800);
		}

		/* Shockwave ring */
		.slam-ring {
			position: absolute;
			inset: 0;
			border: 2px solid var(--slam-ring-color, var(--color-epoch-accent, #f59e0b));
			border-radius: 8px;
			pointer-events: none;
			opacity: 0;
		}

		.slam-ring--active {
			animation: shockwave 400ms ease-out forwards;
		}

		@keyframes shockwave {
			from { transform: scale(0.8); opacity: 0.8; }
			to { transform: scale(2); opacity: 0; }
		}

		/* ── Zone content: fit badge, target preview ── */
		.zone__fit {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			font-family: var(--font-mono, monospace);
			font-size: 9px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			padding: 2px 8px;
			border: 1px solid;
			margin-top: var(--space-1);
		}

		.zone__fit--good { color: var(--color-success); border-color: var(--color-success); }
		.zone__fit--fair { color: var(--color-epoch-accent, #f59e0b); border-color: var(--color-epoch-accent, #f59e0b); }
		.zone__fit--poor { color: var(--color-danger); border-color: var(--color-danger); }

		/* ── Arrow connectors ── */
		.arrow {
			flex-shrink: 0;
			color: var(--color-gray-700);
			transition: color 300ms;
		}

		.arrow--active {
			color: var(--color-epoch-accent, #f59e0b);
		}

		/* ══════════════════════════════════════════════════
		   WIRE + STATUS BAR
		   ══════════════════════════════════════════════════ */
		.wire-bar {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: var(--space-3);
			width: 100%;
			max-width: 600px;
			margin-bottom: var(--space-3);
			padding: var(--space-2) 0;
		}

		.wire-bar__line {
			flex: 1;
			height: 2px;
			background: var(--color-gray-800);
			position: relative;
			overflow: hidden;
		}

		.wire-bar__line--active::after {
			content: '';
			position: absolute;
			inset: 0;
			background: var(--color-epoch-accent, #f59e0b);
			transform: scaleX(0);
			transform-origin: left;
			animation: wire-draw 600ms ease-out forwards;
		}

		@keyframes wire-draw {
			from { transform: scaleX(0); }
			to { transform: scaleX(1); }
		}

		.wire-bar__status {
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.15em;
			color: var(--color-gray-600);
			white-space: nowrap;
		}

		.wire-bar__status--ready {
			color: var(--color-epoch-accent, #f59e0b);
			overflow: hidden;
			animation: typewriter 800ms steps(16) forwards;
		}

		@keyframes typewriter {
			from { max-width: 0; }
			to { max-width: 300px; }
		}

		.wire-bar__pct {
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: var(--text-sm);
			white-space: nowrap;
		}

		/* ══════════════════════════════════════════════════
		   MISSION CARD GRID (step 2)
		   Mid-layout cards: moderate scale, no buffer trick.
		   The hand-fan pattern (giant scale + buffer padding)
		   only works at the modal bottom. Here we scale the
		   card directly with !important to beat animation forwards.
		   ══════════════════════════════════════════════════ */
		.mission-grid {
			display: flex;
			gap: var(--space-3);
			justify-content: center;
			flex-wrap: wrap;
			margin-bottom: var(--space-3);
			/* Allow enlarged cards to paint over siblings */
			position: relative;
		}

		.mission-grid velg-mission-card {
			opacity: 0;
			animation: mission-deal 350ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
			transition:
				filter 250ms ease,
				z-index 0s;
		}

		.mission-grid velg-mission-card:hover {
			z-index: 10;
			/* !important beats animation: forwards fill */
			transform: translateY(-16px) scale(1.35) !important;
			filter:
				drop-shadow(0 0 18px rgba(245 158 11 / 0.35))
				drop-shadow(0 16px 36px rgba(0 0 0 / 0.7));
		}

		.mission-grid:hover velg-mission-card:not(:hover) {
			filter: brightness(0.5) saturate(0.3);
		}

		/* Stagger via nth-child */
		.mission-grid velg-mission-card:nth-child(1) { animation-delay: 0ms; }
		.mission-grid velg-mission-card:nth-child(2) { animation-delay: 80ms; }
		.mission-grid velg-mission-card:nth-child(3) { animation-delay: 160ms; }
		.mission-grid velg-mission-card:nth-child(4) { animation-delay: 240ms; }
		.mission-grid velg-mission-card:nth-child(5) { animation-delay: 320ms; }
		.mission-grid velg-mission-card:nth-child(6) { animation-delay: 400ms; }

		@keyframes mission-deal {
			from { opacity: 0; transform: translateY(-200px) scale(0.5); }
			to { opacity: 1; transform: translateY(0) scale(1); }
		}

		/* ══════════════════════════════════════════════════
		   TARGET CARDS — Classified Zone Dossier Cards
		   ══════════════════════════════════════════════════ */

		/* -- Security-level accent color -- */
		.target-card--high   { --zone-accent: #ef4444; }
		.target-card--medium { --zone-accent: #f59e0b; }
		.target-card--low    { --zone-accent: #22c55e; }

		.target-card {
			--_accent: var(--zone-accent, var(--color-gray-600));
			position: relative;
			flex-shrink: 0;
			width: 168px;
			height: 120px;
			border: 1px solid var(--color-gray-700);
			border-radius: 6px;
			background:
				linear-gradient(175deg, rgba(255 255 255 / 0.02) 0%, transparent 40%),
				linear-gradient(180deg, var(--color-gray-900) 0%, var(--color-gray-950, #030712) 100%);
			cursor: pointer;
			overflow: hidden;
			transition:
				transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1),
				border-color 200ms ease,
				box-shadow 280ms ease,
				filter 200ms ease;
			display: flex;
			flex-direction: column;
			box-shadow:
				inset 0 1px 0 rgba(255 255 255 / 0.04),
				inset 0 -1px 4px rgba(0 0 0 / 0.5),
				0 2px 8px rgba(0 0 0 / 0.4),
				0 0 0 1px rgba(0 0 0 / 0.2);
		}

		/* Top accent stripe — security level indicator */
		.target-card::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 3px;
			background: linear-gradient(
				90deg,
				transparent 0%,
				var(--_accent) 15%,
				var(--_accent) 85%,
				transparent 100%
			);
			opacity: 0.8;
			transition: opacity 200ms ease, height 200ms ease;
			z-index: 2;
		}

		/* Corner bracket targeting marks */
		.target-card::after {
			content: '';
			position: absolute;
			inset: 6px;
			pointer-events: none;
			z-index: 1;
			transition: opacity 200ms ease;
			background:
				/* TL */
				linear-gradient(to right, var(--color-gray-600) 0%, transparent 100%) no-repeat 0 0 / 14px 1px,
				linear-gradient(to bottom, var(--color-gray-600) 0%, transparent 100%) no-repeat 0 0 / 1px 14px,
				/* TR */
				linear-gradient(to left, var(--color-gray-600) 0%, transparent 100%) no-repeat 100% 0 / 14px 1px,
				linear-gradient(to bottom, var(--color-gray-600) 0%, transparent 100%) no-repeat 100% 0 / 1px 14px,
				/* BL */
				linear-gradient(to right, var(--color-gray-600) 0%, transparent 100%) no-repeat 0 100% / 14px 1px,
				linear-gradient(to top, var(--color-gray-600) 0%, transparent 100%) no-repeat 0 100% / 1px 14px,
				/* BR */
				linear-gradient(to left, var(--color-gray-600) 0%, transparent 100%) no-repeat 100% 100% / 14px 1px,
				linear-gradient(to top, var(--color-gray-600) 0%, transparent 100%) no-repeat 100% 100% / 1px 14px;
		}

		/* Card body — content area */
		.target-card__body {
			flex: 1;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			gap: 8px;
			padding: var(--space-3) var(--space-2);
			position: relative;
			z-index: 1;
		}

		.target-card__name {
			font-family: var(--font-brutalist);
			font-weight: 800;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			color: var(--color-gray-200);
			line-height: 1.3;
			text-align: center;
			text-shadow: 0 1px 3px rgba(0 0 0 / 0.6);
		}

		.target-card__type {
			font-family: var(--font-mono, monospace);
			font-size: 8px;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--_accent);
			padding: 2px 8px;
			border: 1px solid color-mix(in srgb, var(--_accent) 35%, transparent);
			border-radius: 2px;
			background: color-mix(in srgb, var(--_accent) 8%, transparent);
			width: fit-content;
			text-shadow: 0 0 6px color-mix(in srgb, var(--_accent) 30%, transparent);
		}

		/* ─── Hover: lift + glow + scale ─── */
		.target-card:hover {
			border-color: color-mix(in srgb, var(--_accent) 50%, var(--color-gray-600));
			transform: translateY(-10px) scale(1.08);
			box-shadow:
				inset 0 1px 0 rgba(255 255 255 / 0.06),
				inset 0 -1px 4px rgba(0 0 0 / 0.5),
				0 0 20px color-mix(in srgb, var(--_accent) 20%, transparent),
				0 16px 32px rgba(0 0 0 / 0.6),
				0 0 0 1px color-mix(in srgb, var(--_accent) 15%, transparent);
		}

		.target-card:hover::before {
			opacity: 1;
			height: 4px;
		}

		.target-card:hover::after {
			background:
				linear-gradient(to right, var(--_accent) 0%, transparent 100%) no-repeat 0 0 / 16px 1px,
				linear-gradient(to bottom, var(--_accent) 0%, transparent 100%) no-repeat 0 0 / 1px 16px,
				linear-gradient(to left, var(--_accent) 0%, transparent 100%) no-repeat 100% 0 / 16px 1px,
				linear-gradient(to bottom, var(--_accent) 0%, transparent 100%) no-repeat 100% 0 / 1px 16px,
				linear-gradient(to right, var(--_accent) 0%, transparent 100%) no-repeat 0 100% / 16px 1px,
				linear-gradient(to top, var(--_accent) 0%, transparent 100%) no-repeat 0 100% / 1px 16px,
				linear-gradient(to left, var(--_accent) 0%, transparent 100%) no-repeat 100% 100% / 16px 1px,
				linear-gradient(to top, var(--_accent) 0%, transparent 100%) no-repeat 100% 100% / 1px 16px;
		}

		.target-card:hover .target-card__name {
			color: var(--color-gray-50);
		}

		/* ─── Selected: amber border + inner glow ─── */
		.target-card--selected {
			border-color: var(--color-epoch-accent, #f59e0b);
			background:
				linear-gradient(175deg, rgba(245 158 11 / 0.06) 0%, transparent 40%),
				linear-gradient(180deg, var(--color-gray-900) 0%, var(--color-gray-950, #030712) 100%);
			box-shadow:
				inset 0 0 24px rgba(245 158 11 / 0.08),
				inset 0 1px 0 rgba(255 255 255 / 0.04),
				0 0 12px rgba(245 158 11 / 0.15),
				0 0 0 1px rgba(245 158 11 / 0.2);
		}

		.target-card--selected::before {
			background: linear-gradient(
				90deg,
				transparent 0%,
				var(--color-epoch-accent, #f59e0b) 10%,
				var(--color-epoch-accent, #f59e0b) 90%,
				transparent 100%
			);
			opacity: 1;
			height: 4px;
		}

		.target-card--selected::after {
			background:
				linear-gradient(to right, var(--color-epoch-accent, #f59e0b) 0%, transparent 100%) no-repeat 0 0 / 16px 1px,
				linear-gradient(to bottom, var(--color-epoch-accent, #f59e0b) 0%, transparent 100%) no-repeat 0 0 / 1px 16px,
				linear-gradient(to left, var(--color-epoch-accent, #f59e0b) 0%, transparent 100%) no-repeat 100% 0 / 16px 1px,
				linear-gradient(to bottom, var(--color-epoch-accent, #f59e0b) 0%, transparent 100%) no-repeat 100% 0 / 1px 16px,
				linear-gradient(to right, var(--color-epoch-accent, #f59e0b) 0%, transparent 100%) no-repeat 0 100% / 16px 1px,
				linear-gradient(to top, var(--color-epoch-accent, #f59e0b) 0%, transparent 100%) no-repeat 0 100% / 1px 16px,
				linear-gradient(to left, var(--color-epoch-accent, #f59e0b) 0%, transparent 100%) no-repeat 100% 100% / 16px 1px,
				linear-gradient(to top, var(--color-epoch-accent, #f59e0b) 0%, transparent 100%) no-repeat 100% 100% / 1px 16px;
		}

		.target-card--selected .target-card__name {
			color: var(--color-epoch-accent, #f59e0b);
		}

		/* ══════════════════════════════════════════════════
		   TARGET SECTION — Intelligence Briefing Layout
		   Full-width zone columns grouped under enemy header
		   ══════════════════════════════════════════════════ */
		.target-section {
			width: 100%;
			padding: 0 var(--space-3);
			margin-top: var(--space-4);
			flex-shrink: 0;
			z-index: 2;
		}

		/* ─── Enemy header banner ─── */
		.target-section__header {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			padding: var(--space-2) var(--space-3);
			margin-bottom: var(--space-3);
			border: 1px solid rgba(245 158 11 / 0.2);
			border-left: 3px solid var(--color-epoch-accent, #f59e0b);
			background:
				linear-gradient(90deg, rgba(245 158 11 / 0.06) 0%, transparent 60%),
				var(--color-gray-900);
			position: relative;
			overflow: hidden;
		}

		/* Scanning line animation on header */
		.target-section__header::after {
			content: '';
			position: absolute;
			top: 0;
			left: -100%;
			width: 60%;
			height: 100%;
			background: linear-gradient(
				90deg,
				transparent 0%,
				rgba(245 158 11 / 0.04) 40%,
				rgba(245 158 11 / 0.08) 50%,
				rgba(245 158 11 / 0.04) 60%,
				transparent 100%
			);
			animation: header-scan 4s ease-in-out infinite;
			pointer-events: none;
		}

		@keyframes header-scan {
			0% { left: -60%; }
			100% { left: 100%; }
		}

		.target-section__header-badge {
			font-family: var(--font-mono, monospace);
			font-size: 8px;
			text-transform: uppercase;
			letter-spacing: 0.15em;
			color: var(--color-epoch-accent, #f59e0b);
			padding: 2px 8px;
			border: 1px solid rgba(245 158 11 / 0.3);
			background: rgba(245 158 11 / 0.08);
			white-space: nowrap;
			flex-shrink: 0;
		}

		.target-section__header-name {
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: 13px;
			text-transform: uppercase;
			letter-spacing: 0.15em;
			color: var(--color-gray-100);
		}

		/* ─── Zone columns grid ─── */
		.target-zone-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: var(--space-3);
			width: 100%;
			margin-bottom: var(--space-3);
		}

		/* Each zone column */
		.target-zone-col {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
		}

		/* Zone column header — security-level colored top bar */
		.target-zone-col__header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: var(--space-1) var(--space-2);
			border-top: 2px solid var(--zone-accent, var(--color-gray-600));
			background:
				linear-gradient(180deg, color-mix(in srgb, var(--zone-accent, var(--color-gray-600)) 6%, transparent) 0%, transparent 100%);
		}

		.target-zone-col__header-name {
			font-family: var(--font-brutalist);
			font-weight: 800;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--color-gray-300);
		}

		.target-zone-col__header-sec {
			font-family: var(--font-mono, monospace);
			font-size: 8px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--zone-accent, var(--color-gray-500));
		}

		/* Buildings sub-list within zone column */
		.target-zone-col__buildings {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			padding-left: var(--space-2);
			border-left: 1px solid var(--color-gray-800);
		}

		/* Target card adjustments within zone columns — fill column width */
		.target-zone-col .target-card {
			width: 100%;
			height: auto;
			min-height: 80px;
		}

		/* Agent target flat grid — full width */
		.target-agent-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
			gap: var(--space-3);
			width: 100%;
		}

		/* ══════════════════════════════════════════════════
		   EMBASSY SELECTOR (inline, step 2)
		   ══════════════════════════════════════════════════ */
		.embassy-bar {
			display: flex;
			align-items: center;
			gap: var(--space-3);
			padding: var(--space-2) var(--space-3);
			border: 1px solid var(--color-gray-800);
			background: var(--color-gray-900);
			margin-bottom: var(--space-3);
			width: 100%;
			max-width: 600px;
		}

		.embassy-bar__label {
			font-family: var(--font-mono, monospace);
			font-size: 9px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--color-gray-500);
			white-space: nowrap;
		}

		.embassy-bar__select {
			flex: 1;
			font-family: var(--font-mono, monospace);
			font-size: var(--text-xs);
			padding: var(--space-1) var(--space-2);
			border: 1px solid var(--color-gray-700);
			background: var(--color-gray-950);
			color: var(--color-gray-100);
			cursor: pointer;
		}

		.embassy-bar__select:focus {
			outline: none;
			border-color: var(--color-epoch-accent, #f59e0b);
		}

		/* ══════════════════════════════════════════════════
		   TARGETING RING (success probability)
		   ══════════════════════════════════════════════════ */
		.targeting {
			display: flex;
			align-items: center;
			gap: var(--space-4);
			padding: var(--space-3);
			border: 1px solid var(--color-gray-800);
			background: var(--color-gray-900);
			margin-top: var(--space-2);
			max-width: 400px;
		}

		.targeting__ring {
			position: relative;
			width: 64px;
			height: 64px;
			flex-shrink: 0;
		}

		.targeting__ring svg {
			width: 64px;
			height: 64px;
			transform: rotate(-90deg);
		}

		.targeting__ring-bg {
			fill: none;
			stroke: var(--color-gray-800);
			stroke-width: 5;
		}

		.targeting__ring-fill {
			fill: none;
			stroke-width: 5;
			stroke-linecap: butt;
			transition: stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s;
		}

		.targeting__pct {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: var(--text-base);
		}

		.targeting__pct--green { color: var(--color-success); }
		.targeting__pct--amber { color: var(--color-epoch-accent, #f59e0b); }
		.targeting__pct--red { color: var(--color-danger); }

		.targeting__details {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		.targeting__factor {
			display: flex;
			justify-content: space-between;
			font-family: var(--font-mono, monospace);
			font-size: 10px;
			color: var(--color-gray-400);
		}

		.targeting__val--pos { color: var(--color-success); font-weight: 700; }
		.targeting__val--neg { color: var(--color-danger); font-weight: 700; }

		/* ══════════════════════════════════════════════════
		   THE HAND — agent card fan
		   ══════════════════════════════════════════════════ */
		.hand {
			position: relative;
			display: flex;
			justify-content: center;
			align-items: flex-end;
			padding: var(--space-3) var(--space-5) var(--space-4);
			min-height: 200px;
			flex-shrink: 0;
			overflow: visible;
			z-index: 2;
		}

		.hand__label {
			position: absolute;
			top: var(--space-1);
			right: var(--space-5);
			font-family: var(--font-mono, monospace);
			font-size: 9px;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--color-gray-600);
		}

		.hand__cards {
			display: flex;
			justify-content: center;
			position: relative;
		}

		.hand__card-wrapper {
			position: relative;
			transition:
				opacity 200ms ease,
				filter 200ms ease,
				margin 250ms cubic-bezier(0.22, 1, 0.36, 1);
			transform-origin: bottom center;
			z-index: 1;
			cursor: pointer;
			margin-left: -12px;
			transform: translateY(var(--fan-y, 0px)) rotateZ(var(--fan-rot, 0deg));
			/* Invisible hover buffer prevents flicker when card scales beyond wrapper */
			padding: 60px 30px 10px;
			margin-top: -60px;
			margin-bottom: -10px;
		}

		.hand__card-wrapper:first-child {
			margin-left: 0;
		}

		/* Scale the card INSIDE the wrapper, not the wrapper itself */
		.hand__card-wrapper velg-game-card {
			transition:
				transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1),
				filter 250ms ease;
			transform-origin: bottom center;
		}

		.hand__card-wrapper:hover {
			z-index: 20;
		}

		.hand__card-wrapper:hover velg-game-card {
			transform: translateY(-60px) rotateZ(0deg) scale(2);
			filter:
				drop-shadow(0 0 24px rgba(245 158 11 / 0.45))
				drop-shadow(0 0 52px rgba(245 158 11 / 0.2))
				drop-shadow(0 30px 60px rgba(0 0 0 / 0.85));
		}

		.hand__card-wrapper:hover ~ .hand__card-wrapper {
			margin-left: 24px;
		}

		.hand__cards:hover .hand__card-wrapper:not(:hover) {
			opacity: 0.3;
			filter: brightness(0.4) saturate(0.3);
		}

		.hand__card-wrapper:hover {
			opacity: 1 !important;
			filter: none !important;
		}

		.hand__card-wrapper--deployed {
			pointer-events: none;
			opacity: 0.3 !important;
			filter: grayscale(0.8);
		}

		.hand__card-wrapper--selected {
			pointer-events: none;
			opacity: 0.25 !important;
		}

		/* Deal animation */
		.hand__card-wrapper--dealing {
			opacity: 0;
			animation: card-deal var(--deal-duration, 350ms)
				cubic-bezier(0.22, 1, 0.36, 1) forwards;
			animation-delay: var(--deal-delay, 0ms);
		}

		@keyframes card-deal {
			from {
				opacity: 0;
				transform: translateY(-200px) rotateZ(0deg) scale(0.5);
			}
			to {
				opacity: 1;
				transform: translateY(var(--fan-y, 0px)) rotateZ(var(--fan-rot, 0deg)) scale(1);
			}
		}

		/* "DEPLOYED" stamp on cards */
		.hand__stamp {
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%) rotate(-15deg);
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: 9px;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			color: var(--color-danger);
			border: 2px solid var(--color-danger);
			padding: 2px 6px;
			white-space: nowrap;
			pointer-events: none;
			z-index: 3;
		}

		/* ══════════════════════════════════════════════════
		   FOOTER
		   ══════════════════════════════════════════════════ */
		.footer {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-3);
			padding: var(--space-3) var(--space-5);
			border-top: 2px solid var(--color-gray-800);
			background: var(--color-gray-900);
			flex-shrink: 0;
			z-index: 2;
		}

		.footer__btn {
			display: inline-flex;
			align-items: center;
			gap: var(--space-2);
			padding: var(--space-2) var(--space-5);
			font-family: var(--font-brutalist);
			font-weight: 700;
			font-size: var(--text-sm);
			text-transform: uppercase;
			letter-spacing: var(--tracking-wide);
			border: 2px solid;
			cursor: pointer;
			transition: all 150ms ease;
		}

		.footer__btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.footer__btn--cancel {
			color: var(--color-gray-400);
			border-color: var(--color-gray-700);
			background: transparent;
		}

		.footer__btn--cancel:hover:not(:disabled) {
			border-color: var(--color-gray-400);
			background: var(--color-gray-800);
		}

		.footer__btn--deploy {
			color: var(--color-gray-950);
			border-color: var(--color-epoch-accent, #f59e0b);
			background: var(--color-epoch-accent, #f59e0b);
			position: relative;
			overflow: hidden;
		}

		.footer__btn--deploy:hover:not(:disabled) {
			box-shadow: 0 0 20px rgba(245 158 11 / 0.4),
				0 0 40px rgba(245 158 11 / 0.15);
			transform: translateY(-1px);
		}

		.footer__btn--deploy::after {
			content: '';
			position: absolute;
			top: -30%;
			left: -80%;
			width: 40%;
			height: 160%;
			background: linear-gradient(90deg, transparent, rgba(255 255 255 / 0.3), transparent);
			transform: skewX(-20deg);
			animation: deploy-shimmer 3s ease-in-out infinite;
		}

		@keyframes deploy-shimmer {
			0%, 70% { left: -80%; }
			100% { left: 180%; }
		}

		.footer__btn--deploy:disabled::after {
			display: none;
		}

		.footer__btn--deploy--ready {
			animation: deploy-pulse 1.5s ease-in-out infinite;
		}

		@keyframes deploy-pulse {
			0%, 100% { box-shadow: 0 0 0 0 rgba(245 158 11 / 0.4); }
			50% { box-shadow: 0 0 20px 4px rgba(245 158 11 / 0.3); }
		}

		/* ══════════════════════════════════════════════════
		   GUARDIAN NOTE
		   ══════════════════════════════════════════════════ */
		.guardian-note {
			font-family: var(--font-mono, monospace);
			font-size: 10px;
			color: var(--color-success);
			padding: var(--space-2) var(--space-3);
			border: 1px solid rgba(74 222 128 / 0.3);
			background: rgba(74 222 128 / 0.05);
			max-width: 400px;
			text-align: center;
		}

		.phase-gate-notice {
			font-family: var(--font-mono, monospace);
			font-size: var(--text-xs);
			color: var(--color-success);
			padding: var(--space-2) var(--space-3);
			border: 1px solid rgba(74 222 128 / 0.25);
			background: rgba(74 222 128 / 0.06);
			margin-bottom: var(--space-3);
			text-align: center;
			max-width: 600px;
		}

		/* ══════════════════════════════════════════════════
		   ERROR
		   ══════════════════════════════════════════════════ */
		.error {
			font-family: var(--font-mono, monospace);
			font-size: var(--text-xs);
			color: var(--color-danger);
			padding: var(--space-2) var(--space-3);
			border: 1px solid rgba(239 68 68 / 0.3);
			background: rgba(239 68 68 / 0.05);
			text-align: center;
			max-width: 600px;
			z-index: 2;
		}

		/* ══════════════════════════════════════════════════
		   DEPLOY ANIMATION SEQUENCE
		   ══════════════════════════════════════════════════ */
		.overlay--charging .zones {
			filter: brightness(1.3);
			transition: filter 400ms ease-in-out;
		}

		.overlay--charging .zone--filled {
			transform: scale(0.95);
			transition: transform 400ms ease-in-out;
		}

		.overlay--frozen {
			background: rgba(10 10 15 / 0.95);
		}

		.overlay--frozen .hand,
		.overlay--frozen .footer {
			opacity: 0.3;
			transition: opacity 200ms;
		}

		.overlay--releasing .zone--filled {
			animation: deploy-release 400ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
		}

		@keyframes deploy-release {
			0% { transform: scale(0.95); filter: brightness(1.5); }
			30% { transform: scale(1.2); }
			100% { transform: scale(1); filter: brightness(1); }
		}

		/* Flash effect */
		.flash {
			position: fixed;
			inset: 0;
			background: white;
			opacity: 0;
			pointer-events: none;
			z-index: 100;
		}

		.flash--active {
			animation: white-flash 300ms ease-out;
		}

		@keyframes white-flash {
			0% { opacity: 0.6; }
			100% { opacity: 0; }
		}

		/* Stamp: "MISSION DISPATCHED" */
		.dispatch-stamp {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%) rotate(-8deg) scale(3);
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: clamp(24px, 4vw, 40px);
			text-transform: uppercase;
			letter-spacing: 0.15em;
			color: var(--color-epoch-accent, #f59e0b);
			border: 4px solid var(--color-epoch-accent, #f59e0b);
			padding: var(--space-2) var(--space-5);
			white-space: nowrap;
			opacity: 0;
			pointer-events: none;
			z-index: 200;
		}

		.dispatch-stamp--active {
			animation: stamp-slam 600ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
		}

		@keyframes stamp-slam {
			0% { opacity: 0; transform: translate(-50%, -50%) rotate(-8deg) scale(3); }
			40% { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg) scale(0.95); }
			60% { transform: translate(-50%, -50%) rotate(-8deg) scale(1.05); }
			100% { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg) scale(1); }
		}

		/* ══════════════════════════════════════════════════
		   MOBILE
		   ══════════════════════════════════════════════════ */
		@media (max-width: 768px) {
			.zones {
				flex-direction: column;
				gap: var(--space-2);
			}

			.zone {
				width: 100px;
				height: 160px;
			}

			.arrow {
				transform: rotate(90deg);
			}

			.hand {
				min-height: auto;
				padding: var(--space-2);
			}

			.hand__cards {
				display: flex;
				gap: var(--space-2);
				overflow-x: auto;
				padding-bottom: var(--space-2);
				scrollbar-width: thin;
				scrollbar-color: var(--color-gray-700) transparent;
			}

			.hand__card-wrapper {
				margin-left: 0;
				transform: none !important;
				flex-shrink: 0;
				padding: 0;
				margin-top: 0;
				margin-bottom: 0;
			}

			.hand__card-wrapper velg-game-card {
				transition: transform 200ms ease;
			}

			.hand__card-wrapper:hover velg-game-card {
				transform: translateY(-8px) scale(1.05);
			}

			.hand__cards:hover .hand__card-wrapper:not(:hover) {
				opacity: 1;
			}

			.mission-grid {
				gap: var(--space-2);
			}

			.targeting {
				flex-direction: column;
				text-align: center;
			}

			.embassy-bar {
				flex-direction: column;
				gap: var(--space-1);
			}
		}

		/* ══════════════════════════════════════════════════
		   REDUCED MOTION
		   ══════════════════════════════════════════════════ */
		@media (prefers-reduced-motion: reduce) {
			.overlay,
			.hand__card-wrapper--dealing,
			.zone--filled,
			.zone--empty,
			.zone--active-target,
			.slam-ring--active,
			.mission-grid velg-mission-card,
			.flash--active,
			.dispatch-stamp--active,
			.footer__btn--deploy--ready,
			.overlay--releasing .zone--filled {
				animation: none !important;
				opacity: 1;
			}

			.overlay::after {
				display: none;
			}

			.hand__card-wrapper,
			.hand__card-wrapper:hover,
			.hand__card-wrapper velg-game-card,
			.hand__card-wrapper:hover velg-game-card,
			.zone--filled,
			.zone--filled:hover,
			.mission-grid velg-mission-card,
			.mission-grid velg-mission-card:hover,
			.wire-bar__line--active::after,
			.wire-bar__status--ready {
				transition: none;
				animation: none !important;
				filter: none !important;
				transform: none !important;
			}

			.wire-bar__line--active::after {
				transform: scaleX(1);
			}

			.wire-bar__status--ready {
				max-width: none;
			}

			.dispatch-stamp--active {
				opacity: 1;
				transform: translate(-50%, -50%) rotate(-8deg) scale(1);
			}
		}
	`;

  // ── Properties (same contract as before) ────────────

  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) epochId = '';
  @property({ attribute: false }) simulationId = '';
  @property({ type: Number }) currentRp = 0;
  @property({ attribute: false }) epochPhase = 'lobby';
  @property({ attribute: false }) deployedAgentIds: string[] = [];

  // ── Internal state ──────────────────────────────────

  @state() private _step: Step = 'asset';
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _dealt = false;

  // Asset
  @state() private _agents: Agent[] = [];
  @state() private _selectedAgentId = '';
  @state() private _aptitudeMap: Map<string, AptitudeSet> = new Map();

  // Mission
  @state() private _selectedType: OperativeType | '' = '';

  // Target
  @state() private _embassies: Embassy[] = [];
  @state() private _selectedEmbassyId = '';
  @state() private _targetZones: Zone[] = [];
  @state() private _selectedZoneId = '';
  @state() private _targetBuildings: Building[] = [];
  @state() private _selectedBuildingId = '';
  @state() private _targetAgents: Agent[] = [];
  @state() private _selectedTargetAgentId = '';

  // Slam animation tracking
  @state() private _slamZone: Step | null = null;
  @state() private _slamColor = '';

  // Deploy animation
  @state() private _deployPhase: DeployPhase = 'idle';

  // Drag & drop
  @state() private _dragOverZone: Step | null = null;

  // ── Lifecycle ───────────────────────────────────────

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._deployPhase === 'idle') this._close();
    if (e.key === 'Tab') {
      trapFocus(e, this.shadowRoot?.querySelector('.overlay'), this);
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._step = 'asset';
      this._loading = false;
      this._error = '';
      this._dealt = false;
      this._selectedAgentId = '';
      this._selectedType = '';
      this._selectedEmbassyId = '';
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._embassies = [];
      this._targetZones = [];
      this._targetBuildings = [];
      this._targetAgents = [];
      this._aptitudeMap = new Map();
      this._slamZone = null;
      this._slamColor = '';
      this._deployPhase = 'idle';
      this._loadAgents();
      this._loadEmbassies();
      requestAnimationFrame(() => {
        this._dealt = true;
        focusFirstElement(this.shadowRoot);
      });
    }
  }

  // ── Data Loading ────────────────────────────────────

  private async _loadAgents(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const [agentResp, aptResp] = await Promise.all([
        agentsApi.list(this.simulationId, { limit: '100' }),
        agentsApi.getAllAptitudes(this.simulationId),
      ]);

      if (agentResp.success && agentResp.data) {
        const items = Array.isArray(agentResp.data)
          ? agentResp.data
          : ((agentResp.data as { data?: Agent[] }).data ?? []);
        this._agents = items;
      }

      if (aptResp.success && aptResp.data) {
        const map = new Map<string, AptitudeSet>();
        for (const row of aptResp.data as AgentAptitude[]) {
          if (!map.has(row.agent_id)) {
            map.set(row.agent_id, {
              spy: 6,
              guardian: 6,
              saboteur: 6,
              propagandist: 6,
              infiltrator: 6,
              assassin: 6,
            });
          }
          const set = map.get(row.agent_id);
          if (set) set[row.operative_type as OperativeType] = row.aptitude_level;
        }
        this._aptitudeMap = map;
      }
    } catch {
      this._agents = [];
    }
  }

  private async _loadEmbassies(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const resp = await embassiesApi.listForSimulation(this.simulationId);
      if (resp.success && resp.data) {
        const items = Array.isArray(resp.data)
          ? resp.data
          : ((resp.data as { data?: Embassy[] }).data ?? []);
        this._embassies = items.filter((e) => e.status === 'active');
      }
    } catch {
      this._embassies = [];
    }
  }

  private async _loadTargetData(targetSimId: string): Promise<void> {
    try {
      const [zonesResp, buildingsResp, agentsResp] = await Promise.all([
        locationsApi.listZones(targetSimId),
        buildingsApi.listPublic(targetSimId, { limit: '100' }),
        agentsApi.listPublic(targetSimId, { limit: '100' }),
      ]);

      if (zonesResp.success && zonesResp.data) {
        this._targetZones = Array.isArray(zonesResp.data)
          ? zonesResp.data
          : ((zonesResp.data as { data?: Zone[] }).data ?? []);
      }
      if (buildingsResp.success && buildingsResp.data) {
        this._targetBuildings = Array.isArray(buildingsResp.data)
          ? buildingsResp.data
          : ((buildingsResp.data as { data?: Building[] }).data ?? []);
      }
      if (agentsResp.success && agentsResp.data) {
        this._targetAgents = Array.isArray(agentsResp.data)
          ? agentsResp.data
          : ((agentsResp.data as { data?: Agent[] }).data ?? []);
      }
    } catch {
      // fail silently
    }
  }

  // ── Computed ────────────────────────────────────────

  private _getSelectedAgent(): Agent | undefined {
    return this._agents.find((a) => a.id === this._selectedAgentId);
  }

  private _getSelectedMissionType(): OperativeTypeInfo | undefined {
    return getOperativeTypes().find((t) => t.type === this._selectedType);
  }

  private _getSelectedEmbassy(): Embassy | undefined {
    return this._embassies.find((e) => e.id === this._selectedEmbassyId);
  }

  private _getTargetSimulationId(): string | undefined {
    const embassy = this._getSelectedEmbassy();
    if (!embassy) return undefined;
    return embassy.simulation_a_id === this.simulationId
      ? embassy.simulation_b_id
      : embassy.simulation_a_id;
  }

  private _getTargetSimulationName(): string {
    const embassy = this._getSelectedEmbassy();
    if (!embassy) return '';
    if (embassy.simulation_a_id === this.simulationId) {
      return embassy.simulation_b?.name ?? '';
    }
    return embassy.simulation_a?.name ?? '';
  }

  private _isGuardian(): boolean {
    return this._selectedType === 'guardian';
  }

  /** Guardian + spy need no entity target (zone/building/agent). Spy still needs embassy route. */
  private _needsNoTarget(): boolean {
    return this._selectedType === 'spy' || this._selectedType === 'guardian';
  }

  /** Only guardians need no embassy route at all (self-deploy). */
  private _needsNoEmbassy(): boolean {
    return this._selectedType === 'guardian';
  }

  /** Infiltrator targets the embassy itself — no further target selection needed */
  private _isEmbassyTarget(): boolean {
    return this._selectedType === 'infiltrator';
  }

  private _isOperationReady(): boolean {
    if (!this._selectedAgentId || !this._selectedType) return false;
    const info = this._getSelectedMissionType();
    if (!info || info.cost > this.currentRp) return false;
    if (this._needsNoEmbassy()) return true;
    if (!this._selectedEmbassyId) return false;
    if (this._needsNoTarget()) return true;
    switch (info.needsTarget) {
      case 'building':
        return this._selectedBuildingId !== '';
      case 'agent':
        return this._selectedTargetAgentId !== '';
      case 'embassy':
        return true; // embassy itself is the target
      case 'zone':
        return this._selectedZoneId !== '';
      default:
        return true;
    }
  }

  private _estimateSuccess(): {
    total: number;
    base: number;
    aptBonus: number;
    zonePenalty: number;
    embBonus: number;
  } {
    const base = 0.55;
    let aptBonus = 0;
    let zonePenalty = 0;
    let embBonus = 0;

    if (this._selectedAgentId && this._selectedType) {
      const apt = this._aptitudeMap.get(this._selectedAgentId);
      if (apt) {
        const val = apt[this._selectedType as keyof AptitudeSet] as number | undefined;
        if (typeof val === 'number') {
          aptBonus = (val - 5) * 0.03;
        }
      }
    }

    if (this._selectedZoneId) {
      const zone = this._targetZones.find((z) => z.id === this._selectedZoneId);
      if (zone) {
        const secMap: Record<string, number> = { low: 1, medium: 2, high: 3 };
        zonePenalty = (secMap[zone.security_level] ?? 2) * 0.05;
      }
    }

    if (this._selectedEmbassyId) embBonus = 0.15;

    const total = Math.max(0.05, Math.min(0.95, base + aptBonus - zonePenalty + embBonus));
    return { total, base, aptBonus, zonePenalty, embBonus };
  }

  private _getFitLevel(aptitude: number): { label: string; css: string } {
    if (aptitude >= 7) return { label: msg('Good'), css: 'good' };
    if (aptitude >= 5) return { label: msg('Fair'), css: 'fair' };
    return { label: msg('Poor'), css: 'poor' };
  }

  private _fanGeometry(index: number, total: number): { rot: number; y: number } {
    if (total <= 1) return { rot: 0, y: 0 };
    const center = (total - 1) / 2;
    const maxRot = Math.min(30, total * 5);
    const rot = (index - center) * (maxRot / total);
    const y = Math.abs(index - center) * 8;
    return { rot, y };
  }

  private _getBestAptitude(apt: AptitudeSet): { type: OperativeType; level: number } {
    const types: OperativeType[] = [
      'spy',
      'guardian',
      'saboteur',
      'propagandist',
      'infiltrator',
      'assassin',
    ];
    let best: OperativeType = 'spy';
    let bestLevel = 0;
    for (const t of types) {
      if (apt[t] > bestLevel) {
        bestLevel = apt[t];
        best = t;
      }
    }
    return { type: best, level: bestLevel };
  }

  private _getAgentRarity(agent: Agent): 'common' | 'rare' | 'legendary' {
    if (agent.is_ambassador) return 'legendary';
    const apt = this._aptitudeMap.get(agent.id);
    if (apt) {
      for (const val of Object.values(apt)) {
        if (val >= 9) return 'legendary';
      }
    }
    if (agent.data_source === 'ai') return 'rare';
    return 'common';
  }

  // ── Actions ─────────────────────────────────────────

  private _selectAgent(agentId: string): void {
    if (this.deployedAgentIds.includes(agentId)) return;
    this._selectedAgentId = agentId;
    this._step = 'mission';
    this._triggerSlam('asset', '');
  }

  private _selectMission(type: OperativeType): void {
    const info = getOperativeTypes().find((t) => t.type === type);
    if (!info || info.cost > this.currentRp) return;
    this._selectedType = type;
    this._triggerSlam('mission', OP_COLORS[type] ?? '#f59e0b');

    if (this._needsNoEmbassy()) {
      this._step = 'target';
    } else if (this._needsNoTarget() && this._selectedEmbassyId) {
      // Spy: embassy already selected, go straight to target
      this._step = 'target';
    } else if (this._isEmbassyTarget() && this._selectedEmbassyId) {
      // Infiltrator: embassy IS the target, auto-fill and slam
      this._step = 'target';
      this._triggerSlam('target', OP_COLORS[type] ?? '#a78bfa');
    } else if (this._selectedEmbassyId) {
      this._step = 'target';
      const targetSimId = this._getTargetSimulationId();
      if (targetSimId) this._loadTargetData(targetSimId);
    }
  }

  private _selectEmbassy(embassyId: string): void {
    this._selectedEmbassyId = embassyId;
    this._selectedZoneId = '';
    this._selectedBuildingId = '';
    this._selectedTargetAgentId = '';
    this._targetZones = [];
    this._targetBuildings = [];
    this._targetAgents = [];

    if (this._selectedType) {
      this._step = 'target';
      if (this._isEmbassyTarget() || this._needsNoTarget()) {
        // Infiltrator: embassy IS the target. Spy: no entity target needed.
        this._triggerSlam('target', OP_COLORS[this._selectedType] ?? '#a78bfa');
      } else {
        const targetSimId = this._getTargetSimulationId();
        if (targetSimId) this._loadTargetData(targetSimId);
      }
    }
  }

  private _selectTarget(id: string, entityType: string): void {
    if (entityType === 'zone') this._selectedZoneId = id;
    else if (entityType === 'building') this._selectedBuildingId = id;
    else if (entityType === 'agent') this._selectedTargetAgentId = id;
    this._triggerSlam('target', '');
  }

  // ── Drag & drop ──────────────────────────────────────

  private _onAgentDragStart(e: DragEvent, agentId: string): void {
    e.dataTransfer?.setData('text/agent-id', agentId);
  }

  private _onMissionDragStart(e: DragEvent, type: OperativeType): void {
    e.dataTransfer?.setData('text/mission-type', type);
  }

  private _onZoneDragOver(e: DragEvent, zone: Step): void {
    e.preventDefault();
    if (zone !== this._step) return;
    this._dragOverZone = zone;
  }

  private _onZoneDragLeave(): void {
    this._dragOverZone = null;
  }

  private _onZoneDrop(e: DragEvent, zone: Step): void {
    e.preventDefault();
    this._dragOverZone = null;
    if (zone !== this._step) return;

    const agentId = e.dataTransfer?.getData('text/agent-id');
    if (agentId && zone === 'asset') {
      if (!this.deployedAgentIds.includes(agentId)) {
        this._selectAgent(agentId);
      }
      return;
    }

    const missionType = e.dataTransfer?.getData('text/mission-type');
    if (missionType && zone === 'mission') {
      this._selectMission(missionType as OperativeType);
    }
  }

  private _removeZone(zone: Step): void {
    if (zone === 'asset') {
      this._selectedAgentId = '';
      this._selectedType = '';
      this._selectedEmbassyId = '';
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._step = 'asset';
    } else if (zone === 'mission') {
      this._selectedType = '';
      this._selectedEmbassyId = '';
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._step = 'mission';
    } else if (zone === 'target') {
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._step = 'target';
    }
  }

  private _triggerSlam(zone: Step, color: string): void {
    this._slamZone = zone;
    this._slamColor = color;
    setTimeout(() => {
      this._slamZone = null;
    }, 450);
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  // ── Deploy ──────────────────────────────────────────

  private async _handleDeploy(): Promise<void> {
    if (this._loading || this._deployPhase !== 'idle' || !this.epochId || !this.simulationId)
      return;

    const missionType = this._getSelectedMissionType();
    if (!missionType || !this._isOperationReady()) return;

    // Start animation + API call simultaneously
    this._deployPhase = 'charging';
    this._loading = true;
    this._error = '';

    const data: Record<string, unknown> = {
      agent_id: this._selectedAgentId,
      operative_type: this._selectedType,
    };

    if (!this._isGuardian()) {
      const targetSimId = this._getTargetSimulationId();
      if (targetSimId) data.target_simulation_id = targetSimId;
      if (this._selectedEmbassyId) data.embassy_id = this._selectedEmbassyId;
    }

    if (missionType.needsTarget === 'building' && this._selectedBuildingId) {
      data.target_entity_id = this._selectedBuildingId;
      data.target_entity_type = 'building';
    } else if (missionType.needsTarget === 'agent' && this._selectedTargetAgentId) {
      data.target_entity_id = this._selectedTargetAgentId;
      data.target_entity_type = 'agent';
    } else if (missionType.needsTarget === 'embassy' && this._selectedEmbassyId) {
      data.target_entity_id = this._selectedEmbassyId;
      data.target_entity_type = 'embassy';
    }

    if (this._selectedZoneId) {
      data.target_zone_id = this._selectedZoneId;
    }

    try {
      const [resp] = await Promise.all([
        epochsApi.deployOperative(
          this.epochId,
          this.simulationId,
          data as {
            agent_id: string;
            operative_type: string;
            target_simulation_id?: string;
            embassy_id?: string;
            target_entity_id?: string;
            target_entity_type?: string;
            target_zone_id?: string;
          },
        ),
        this._runDeployAnimation(),
      ]);

      if (resp.success) {
        VelgToast.success(
          msg(
            str`Operative deployed. Mission ${(resp.data as OperativeMission).operative_type} initiated.`,
          ),
        );
        this.dispatchEvent(
          new CustomEvent('operative-deployed', {
            detail: resp.data,
            bubbles: true,
            composed: true,
          }),
        );
        // Close after stamp finishes
        await this._delay(500);
        this._close();
      } else {
        this._deployPhase = 'idle';
        this._error = (resp.error as { message?: string })?.message ?? msg('Deployment failed.');
      }
    } catch {
      this._deployPhase = 'idle';
      this._error = msg('Deployment failed.');
    } finally {
      this._loading = false;
    }
  }

  private async _runDeployAnimation(): Promise<void> {
    // Charge: 400ms
    await this._delay(400);
    // Freeze: 200ms
    this._deployPhase = 'frozen';
    await this._delay(200);
    // Release: 400ms
    this._deployPhase = 'releasing';
    await this._delay(400);
    // Resolved: stamp
    this._deployPhase = 'resolved';
    await this._delay(800);
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Render ──────────────────────────────────────────

  protected render() {
    if (!this.open) return nothing;

    const overlayClasses = classMap({
      overlay: true,
      'overlay--charging': this._deployPhase === 'charging',
      'overlay--frozen': this._deployPhase === 'frozen',
      'overlay--releasing': this._deployPhase === 'releasing',
    });

    return html`
			<div class=${overlayClasses} role="dialog" aria-modal="true" aria-label=${msg('Deploy Operative')}>
				${this._renderHeader()}
				${this._renderTable()}
				${this._renderFooter()}

				<!-- Deploy animation overlays -->
				<div class="flash ${this._deployPhase === 'releasing' ? 'flash--active' : ''}"></div>
				<div class="dispatch-stamp ${this._deployPhase === 'resolved' ? 'dispatch-stamp--active' : ''}">
					${msg('MISSION DISPATCHED')}
				</div>
			</div>
		`;
  }

  // ── Header ──────────────────────────────────────────

  private _renderHeader() {
    const stepLabel =
      this._step === 'asset'
        ? msg('Select an agent from your roster')
        : this._step === 'mission'
          ? msg('Choose a mission type')
          : msg('Select a target');

    return html`
			<div class="header">
				<div class="header__left">
					<span class="header__title">${msg('Deploy Operative')}</span>
					<span class="header__subtitle">${stepLabel}</span>
				</div>
				<div style="display:flex;align-items:center;gap:var(--space-3)">
					<span class="header__rp">RP: ${this.currentRp}</span>
					<button
						class="header__close"
						@click=${this._close}
						aria-label=${msg('Cancel')}
					>${icons.close(18)}</button>
				</div>
			</div>
		`;
  }

  // ── War Table (zones) ───────────────────────────────

  private _renderTable() {
    const agent = this._getSelectedAgent();
    const missionInfo = this._getSelectedMissionType();
    const isReady = this._isOperationReady();

    // Determine target display name
    let targetName = '';
    if (this._isEmbassyTarget() && this._selectedEmbassyId) {
      // Infiltrator: embassy is the target — show target simulation name
      const emb = this._getSelectedEmbassy();
      if (emb) {
        targetName =
          (emb.simulation_a_id === this.simulationId
            ? emb.simulation_b?.name
            : emb.simulation_a?.name) ?? msg('Embassy');
      }
    } else if (this._selectedZoneId) {
      targetName = this._targetZones.find((z) => z.id === this._selectedZoneId)?.name ?? '';
    } else if (this._selectedBuildingId) {
      targetName = this._targetBuildings.find((b) => b.id === this._selectedBuildingId)?.name ?? '';
    } else if (this._selectedTargetAgentId) {
      targetName = this._targetAgents.find((a) => a.id === this._selectedTargetAgentId)?.name ?? '';
    }
    const targetSimName = this._getTargetSimulationName();

    return html`
			<div class="table">
				<div class="zones" aria-label=${msg('Operation briefing zones')}>
					<!-- ASSET ZONE -->
					${this._renderZone(
            'asset',
            msg('Asset'),
            !!agent,
            this._step === 'asset',
            false,
            agent
              ? html`
								${(() => {
                  const apt = this._aptitudeMap.get(agent.id) ?? null;
                  const best = apt ? this._getBestAptitude(apt) : null;
                  const subtitle = [agent.primary_profession, agent.gender]
                    .filter(Boolean)
                    .join(' \u00b7 ');
                  return html`<velg-game-card
									type="agent"
									size="sm"
									name=${agent.name}
									.imageUrl=${agent.portrait_image_url ?? ''}
									.primaryStat=${36}
									.secondaryStat=${best?.level ?? null}
									.rarity=${this._getAgentRarity(agent)}
									.aptitudes=${apt}
									.subtitle=${subtitle}
									.interactive=${false}
								></velg-game-card>`;
                })()}
								${(() => {
                  const apt = this._selectedType ? this._aptitudeMap.get(agent.id) : undefined;
                  if (!apt || !this._selectedType) return nothing;
                  const fit = this._getFitLevel(apt[this._selectedType as OperativeType]);
                  return html`<span class="zone__fit zone__fit--${fit.css}">
										${msg('Fit')}: ${fit.label}
									</span>`;
                })()}
							`
              : nothing,
          )}

					<!-- Arrow 1 -->
					<span class="arrow ${agent ? 'arrow--active' : ''}">
						${svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M5 12h14M13 6l6 6-6 6"/>
						</svg>`}
					</span>

					<!-- MISSION ZONE -->
					${this._renderZone(
            'mission',
            msg('Mission'),
            !!missionInfo,
            this._step === 'mission',
            !agent,
            missionInfo
              ? html`
								<velg-mission-card
									operative-type=${missionInfo.type}
									.cost=${missionInfo.cost}
									.effectText=${missionInfo.effect}
									.duration=${missionInfo.duration}
									.selected=${true}
									.interactive=${false}
								></velg-mission-card>
							`
              : nothing,
          )}

					<!-- Arrow 2 -->
					<span class="arrow ${missionInfo ? 'arrow--active' : ''}">
						${svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M5 12h14M13 6l6 6-6 6"/>
						</svg>`}
					</span>

					<!-- TARGET ZONE -->
					${this._renderZone(
            'target',
            this._isGuardian() ? msg('Deploy') : msg('Target'),
            (this._needsNoEmbassy() ||
              (this._needsNoTarget() && this._selectedEmbassyId) ||
              this._isEmbassyTarget()) &&
              this._selectedType !== ''
              ? true
              : !!targetName,
            this._step === 'target',
            !missionInfo,
            this._needsNoTarget() &&
              this._selectedType !== '' &&
              (this._needsNoEmbassy() || this._selectedEmbassyId)
              ? html`
								<div style="text-align:center;padding:var(--space-2)">
									<div style="margin-bottom:var(--space-2);color:var(--color-gray-300)">${this._isGuardian() ? icons.operativeGuardian(32) : icons.operativeSpy(32)}</div>
									<div style="font-family:var(--font-brutalist);font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-gray-300)">
										${this._isGuardian() ? msg('Your simulation') : msg('ALL SECTORS')}
									</div>
								</div>
							`
              : this._isEmbassyTarget() && this._selectedEmbassyId
                ? html`
									<div style="text-align:center;padding:var(--space-2)">
										<div style="margin-bottom:var(--space-2);color:var(--color-gray-300)">${icons.operativeInfiltrator(32)}</div>
										<div style="font-family:var(--font-brutalist);font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-gray-100);margin-bottom:4px">
											${targetName}
										</div>
										<div style="font-family:var(--font-mono,monospace);font-size:9px;color:var(--color-gray-500);text-transform:uppercase">
											${targetSimName}
										</div>
									</div>
								`
                : targetName
                  ? html`
									<div style="text-align:center;padding:var(--space-2)">
										<div style="font-family:var(--font-brutalist);font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-gray-100);margin-bottom:4px">
											${targetName}
										</div>
										<div style="font-family:var(--font-mono,monospace);font-size:9px;color:var(--color-gray-500);text-transform:uppercase">
											${targetSimName}
										</div>
									</div>
								`
                  : nothing,
          )}
				</div>

				<!-- Counter pips -->
				<div class="counter-pips">
					<div class="counter-pip ${this._selectedAgentId ? 'counter-pip--filled' : ''}"></div>
					<div class="counter-pip ${this._selectedType ? 'counter-pip--filled' : ''}"></div>
					<div class="counter-pip ${isReady ? 'counter-pip--filled' : ''}"></div>
				</div>

				<!-- Wire bar + status -->
				${this._renderWireBar(isReady)}

				<!-- Embassy selector (inline, when mission needs embassy) -->
				${this._selectedType && !this._needsNoEmbassy() ? this._renderEmbassySelector() : nothing}

				<!-- Guardian note -->
				${
          this._isGuardian()
            ? html`<div class="guardian-note">${msg('Guardians deploy to your OWN simulation. No embassy required.')}</div>`
            : nothing
        }

				<!-- Foundation phase gate -->
				${
          this.epochPhase === 'foundation' && this._step === 'mission'
            ? html`<div class="phase-gate-notice">${msg('Foundation phase: only guardians and spies may be deployed.')}</div>`
            : nothing
        }

				<!-- Targeting ring (when target selected) -->
				${
          this._selectedType && !this._needsNoEmbassy() && this._selectedEmbassyId
            ? this._renderTargetingRing()
            : nothing
        }

				${this._error ? html`<div class="error">${this._error}</div>` : nothing}

				${this._step === 'asset' ? this._renderHand() : nothing}
				${this._step === 'mission' ? this._renderMissionSelection() : nothing}
				${this._step === 'target' && !this._needsNoTarget() && !this._isEmbassyTarget() ? this._renderTargetSelection() : nothing}
			</div>
		`;
  }

  private _renderZone(
    zone: Step,
    label: string,
    filled: boolean,
    active: boolean,
    locked: boolean,
    content: unknown,
  ) {
    const classes = classMap({
      zone: true,
      'zone--empty': !filled && !locked && active,
      'zone--filled': filled,
      'zone--locked': locked,
      'zone--active-target':
        active && !filled && !locked && zone === 'target' && this._step === 'target',
      'zone--dragover': this._dragOverZone === zone && !filled,
    });

    const slamRingColor = this._slamColor || 'var(--color-epoch-accent, #f59e0b)';

    return html`
			<div
				class=${classes}
				aria-label=${filled ? `${label}: ${this._getZoneAriaLabel(zone)}` : `${label}: ${msg('empty')}`}
				@dragover=${(e: DragEvent) => this._onZoneDragOver(e, zone)}
				@dragleave=${this._onZoneDragLeave}
				@drop=${(e: DragEvent) => this._onZoneDrop(e, zone)}
			>
				${
          !filled
            ? html`
					<div class="zone__silhouette">
						<div class="zone__silhouette-frame"></div>
					</div>
					<span class="zone__label">${label}</span>
					${!locked ? html`<span class="zone__hint">${this._getZoneHint(zone)}</span>` : nothing}
				`
            : nothing
        }
				${filled ? content : nothing}
				${
          filled
            ? html`
					<button
						class="zone__remove"
						@click=${() => this._removeZone(zone)}
						aria-label=${msg(str`Remove ${label}`)}
					>${icons.close(12)}</button>
				`
            : nothing
        }
				<div
					class="slam-ring ${this._slamZone === zone ? 'slam-ring--active' : ''}"
					style=${styleMap({ '--slam-ring-color': slamRingColor })}
				></div>
			</div>
		`;
  }

  private _getZoneHint(zone: Step): string {
    if (zone === 'asset') return '';
    if (zone === 'mission') return '';
    return '';
  }

  private _getZoneAriaLabel(zone: Step): string {
    if (zone === 'asset') return this._getSelectedAgent()?.name ?? '';
    if (zone === 'mission') return this._selectedType;
    if (this._selectedZoneId)
      return this._targetZones.find((z) => z.id === this._selectedZoneId)?.name ?? '';
    if (this._selectedBuildingId)
      return this._targetBuildings.find((b) => b.id === this._selectedBuildingId)?.name ?? '';
    if (this._selectedTargetAgentId)
      return this._targetAgents.find((a) => a.id === this._selectedTargetAgentId)?.name ?? '';
    return '';
  }

  // ── Wire + status bar ───────────────────────────────

  private _renderWireBar(isReady: boolean) {
    const estimate = this._estimateSuccess();
    const successPct = Math.round(estimate.total * 100);
    const showPct = this._selectedType && !this._needsNoEmbassy();

    return html`
			<div class="wire-bar">
				<div class="wire-bar__line ${isReady ? 'wire-bar__line--active' : ''}"></div>
				<span class="wire-bar__status ${isReady ? 'wire-bar__status--ready' : ''}">
					${isReady ? msg('OPERATION READY') : msg('AWAITING PARAMETERS')}
				</span>
				${
          showPct
            ? html`
					<span class="wire-bar__pct" style="color:${successPct >= 70 ? 'var(--color-success)' : successPct >= 40 ? 'var(--color-epoch-accent,#f59e0b)' : 'var(--color-danger)'}">
						${successPct}%
					</span>
				`
            : nothing
        }
				<div class="wire-bar__line ${isReady ? 'wire-bar__line--active' : ''}"></div>
			</div>
		`;
  }

  // ── Embassy selector ────────────────────────────────

  private _renderEmbassySelector() {
    return html`
			<div class="embassy-bar">
				<span class="embassy-bar__label">${msg('Route through Embassy')}</span>
				<select
					class="embassy-bar__select"
					aria-label=${msg('Route through Embassy')}
					.value=${this._selectedEmbassyId}
					@change=${(e: Event) => this._selectEmbassy((e.target as HTMLSelectElement).value)}
				>
					<option value="">${msg('-- Select embassy route --')}</option>
					${this._embassies.map((emb) => {
            const targetName =
              emb.simulation_a_id === this.simulationId
                ? emb.simulation_b?.name
                : emb.simulation_a?.name;
            return html`<option value=${emb.id}>${targetName ?? msg('Unknown')}</option>`;
          })}
				</select>
			</div>
		`;
  }

  // ── Targeting ring ──────────────────────────────────

  private _renderTargetingRing() {
    const estimate = this._estimateSuccess();
    const successPct = Math.round(estimate.total * 100);
    const circumference = 2 * Math.PI * 26;
    const dashoffset = circumference * (1 - successPct / 100);
    const ringColor =
      successPct >= 70
        ? 'var(--color-success)'
        : successPct >= 40
          ? 'var(--color-epoch-accent, #f59e0b)'
          : 'var(--color-danger)';
    const pctClass =
      successPct >= 70
        ? 'targeting__pct--green'
        : successPct >= 40
          ? 'targeting__pct--amber'
          : 'targeting__pct--red';

    const fmtBonus = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

    return html`
			<div class="targeting">
				<div class="targeting__ring">
					<svg viewBox="0 0 64 64" aria-hidden="true">
						<circle class="targeting__ring-bg" cx="32" cy="32" r="26" />
						<circle
							class="targeting__ring-fill"
							cx="32" cy="32" r="26"
							stroke=${ringColor}
							stroke-dasharray=${circumference}
							stroke-dashoffset=${dashoffset}
						/>
					</svg>
					<span class="targeting__pct ${pctClass}">${successPct}%</span>
				</div>
				<div class="targeting__details">
					<div class="targeting__factor">
						<span>${msg('Base probability')}</span>
						<span>${Math.round(estimate.base * 100)}%</span>
					</div>
					<div class="targeting__factor">
						<span>${msg('Agent aptitude')}</span>
						<span class="${estimate.aptBonus >= 0 ? 'targeting__val--pos' : 'targeting__val--neg'}">${fmtBonus(estimate.aptBonus)}</span>
					</div>
					<div class="targeting__factor">
						<span>${msg('Zone security')}</span>
						<span class="${estimate.zonePenalty > 0 ? 'targeting__val--neg' : ''}">${estimate.zonePenalty > 0 ? `-${Math.round(estimate.zonePenalty * 100)}%` : '0%'}</span>
					</div>
					<div class="targeting__factor">
						<span>${msg('Embassy effectiveness')}</span>
						<span class="${estimate.embBonus > 0 ? 'targeting__val--pos' : ''}">${fmtBonus(estimate.embBonus)}</span>
					</div>
				</div>
			</div>
		`;
  }

  // ── The Hand (agent card fan) ───────────────────────

  private _renderHand() {
    const agents = this._agents;
    const total = agents.length;

    return html`
			<div class="hand">
				<span class="hand__label">${msg('YOUR ROSTER')}</span>
				<div class="hand__cards">
					${agents.map((agent, i) => {
            const { rot, y } = this._fanGeometry(i, total);
            const isDeployed = this.deployedAgentIds.includes(agent.id);
            const isSelected = agent.id === this._selectedAgentId;
            const apt = this._aptitudeMap.get(agent.id) ?? null;
            const best = apt ? this._getBestAptitude(apt) : null;
            const subtitle = [agent.primary_profession, agent.gender]
              .filter(Boolean)
              .join(' \u00b7 ');

            const wrapClasses = classMap({
              'hand__card-wrapper': true,
              'hand__card-wrapper--dealing': this._dealt,
              'hand__card-wrapper--deployed': isDeployed,
              'hand__card-wrapper--selected': isSelected,
            });

            return html`
							<div
								class=${wrapClasses}
								style=${styleMap({
                  '--fan-rot': `${rot}deg`,
                  '--fan-y': `${y}px`,
                  '--deal-delay': `${i * 80}ms`,
                })}
								draggable=${isDeployed ? 'false' : 'true'}
								@dragstart=${(e: DragEvent) => this._onAgentDragStart(e, agent.id)}
								@click=${() => this._selectAgent(agent.id)}
								role="button"
								tabindex=${isDeployed ? -1 : 0}
								aria-label=${agent.name}
								@keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._selectAgent(agent.id);
                  }
                }}
							>
								<velg-game-card
									type="agent"
									size="sm"
									name=${agent.name}
									.imageUrl=${agent.portrait_image_url ?? ''}
									.primaryStat=${36}
									.secondaryStat=${best?.level ?? null}
									.rarity=${this._getAgentRarity(agent)}
									.aptitudes=${apt}
									.subtitle=${subtitle}
									.dimmed=${isDeployed || isSelected}
								></velg-game-card>
								${isDeployed ? html`<span class="hand__stamp">${msg('DEPLOYED')}</span>` : nothing}
							</div>
						`;
          })}
				</div>
			</div>
		`;
  }

  // ── Mission card grid ───────────────────────────────

  private _renderMissionSelection() {
    const allTypes = getOperativeTypes();
    const isFoundation = this.epochPhase === 'foundation';
    const types = isFoundation
      ? allTypes.filter((t) => t.type === 'guardian' || t.type === 'spy')
      : allTypes;

    return html`
			<div style="display:flex;flex-direction:column;align-items:center;padding:0 var(--space-5) var(--space-4);flex-shrink:0;z-index:2">
				<div class="mission-grid">
					${types.map(
            (t) => html`
						<div
							draggable=${t.cost <= this.currentRp ? 'true' : 'false'}
							@dragstart=${(e: DragEvent) => this._onMissionDragStart(e, t.type)}
						>
							<velg-mission-card
								operative-type=${t.type}
								.cost=${t.cost}
								.effectText=${t.effect}
								.duration=${t.duration}
								.selected=${this._selectedType === t.type}
								.disabled=${t.cost > this.currentRp}
								@card-click=${() => this._selectMission(t.type)}
							></velg-mission-card>
						</div>
					`,
          )}
				</div>
			</div>
		`;
  }

  // ── Target selection ────────────────────────────────

  private _renderTargetSelection() {
    const missionInfo = this._getSelectedMissionType();
    if (!missionInfo) return nothing;
    const targetSimName = this._getTargetSimulationName();

    return html`
			<div class="target-section">
				<!-- Enemy header banner -->
				${
          targetSimName
            ? html`
						<div class="target-section__header">
							<span class="target-section__header-badge">${msg('Hostile Territory')}</span>
							<span class="target-section__header-name">${targetSimName}</span>
						</div>
					`
            : nothing
        }

				${
          missionInfo.needsTarget === 'zone' || missionInfo.needsTarget === 'building'
            ? this._renderZoneTargets(missionInfo)
            : nothing
        }
				${missionInfo.needsTarget === 'agent' ? this._renderAgentTargets() : nothing}
				${
          missionInfo.needsTarget === 'embassy'
            ? html`<div class="guardian-note" style="color:var(--color-epoch-accent,#f59e0b);border-color:rgba(245 158 11/0.3);background:rgba(245 158 11/0.05)">
						${msg('Select embassy route first')}
					</div>`
            : nothing
        }
			</div>
		`;
  }

  private _getSecurityClass(level?: string): string {
    const l = (level ?? '').toLowerCase();
    if (l === 'high') return 'target-card--high';
    if (l === 'medium') return 'target-card--medium';
    if (l === 'low') return 'target-card--low';
    return 'target-card--medium';
  }

  private _getSecurityVar(level?: string): string {
    const l = (level ?? '').toLowerCase();
    if (l === 'high') return '#ef4444';
    if (l === 'low') return '#22c55e';
    return '#f59e0b';
  }

  private _renderZoneTargets(missionInfo: OperativeTypeInfo) {
    const needsBuilding = missionInfo.needsTarget === 'building';

    return html`
			<div class="target-zone-grid">
				${this._targetZones.map((z) => {
          const secClass = this._getSecurityClass(z.security_level);
          const secColor = this._getSecurityVar(z.security_level);
          const isZoneSelected = this._selectedZoneId === z.id;
          // Filter buildings for this zone
          const zoneBuildings = needsBuilding
            ? this._targetBuildings.filter((b) => b.zone_id === z.id)
            : [];

          return html`
						<div class="target-zone-col" style="--zone-accent:${secColor}">
							<!-- Zone card (clickable) -->
							<div
								class="target-card ${secClass} ${isZoneSelected ? 'target-card--selected' : ''}"
								role="button"
								tabindex="0"
								aria-label=${z.name}
								@click=${() => {
                  this._selectedZoneId = z.id;
                  if (missionInfo.needsTarget === 'zone') this._triggerSlam('target', '');
                }}
								@keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._selectedZoneId = z.id;
                    if (missionInfo.needsTarget === 'zone') this._triggerSlam('target', '');
                  }
                }}
							>
								<div class="target-card__body">
									<span class="target-card__name">${z.name}</span>
									<span class="target-card__type">${z.security_level}</span>
								</div>
							</div>

							<!-- Buildings under this zone (when building-targeting + zone selected) -->
							${
                needsBuilding && isZoneSelected && zoneBuildings.length > 0
                  ? html`
									<div class="target-zone-col__buildings">
										${zoneBuildings.map(
                      (b) => html`
											<div
												class="target-card target-card--medium ${this._selectedBuildingId === b.id ? 'target-card--selected' : ''}"
												role="button"
												tabindex="0"
												aria-label=${b.name}
												@click=${() => this._selectTarget(b.id, 'building')}
												@keydown=${(e: KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this._selectTarget(b.id, 'building');
                          }
                        }}
											>
												<div class="target-card__body">
													<span class="target-card__name">${b.name}</span>
													<span class="target-card__type">${b.building_type}</span>
												</div>
											</div>
										`,
                    )}
									</div>
								`
                  : nothing
              }
						</div>
					`;
        })}
			</div>
		`;
  }

  private _renderAgentTargets() {
    return html`
			<div class="target-agent-grid">
				${this._targetAgents.map(
          (a) => html`
					<div
						class="target-card target-card--high ${this._selectedTargetAgentId === a.id ? 'target-card--selected' : ''}"
						role="button"
						tabindex="0"
						aria-label=${a.name}
						@click=${() => this._selectTarget(a.id, 'agent')}
						@keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._selectTarget(a.id, 'agent');
              }
            }}
					>
						<div class="target-card__body">
							<span class="target-card__name">${a.name}</span>
							<span class="target-card__type">${a.professions?.[0]?.profession ?? ''}</span>
						</div>
					</div>
				`,
        )}
			</div>
		`;
  }

  // ── Footer ──────────────────────────────────────────

  private _renderFooter() {
    const isReady = this._isOperationReady();

    const deployClasses = classMap({
      footer__btn: true,
      'footer__btn--deploy': true,
      'footer__btn--deploy--ready': isReady && this._deployPhase === 'idle',
    });

    return html`
			<div class="footer">
				<button
					class="footer__btn footer__btn--cancel"
					@click=${this._close}
					?disabled=${this._deployPhase !== 'idle'}
				>${msg('Cancel')}</button>
				<button
					class=${deployClasses}
					?disabled=${!isReady || this._loading || this._deployPhase !== 'idle'}
					@click=${this._handleDeploy}
				>
					${
            this._loading && this._deployPhase !== 'idle'
              ? msg('Deploying...')
              : msg('Deploy Operative')
          }
				</button>
			</div>
		`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-deploy-operative-modal': VelgDeployOperativeModal;
  }
}
