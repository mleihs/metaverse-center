import { css } from 'lit';

export const deployOperativeStyles = css`
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
			background: var(--color-surface-sunken);
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
			border-bottom: 2px solid var(--color-border);
			background: var(--color-surface);
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
			color: var(--color-text-primary);
		}

		.header__subtitle {
			font-family: var(--font-mono, monospace);
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--color-text-muted);
		}

		.header__rp {
			display: inline-flex;
			align-items: center;
			gap: var(--space-1);
			padding: var(--space-1) var(--space-3);
			border: 1px solid var(--color-primary-border);
			background: var(--color-primary-bg);
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: var(--text-sm);
			color: var(--color-epoch-accent);
		}

		.header__close {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 36px;
			height: 36px;
			padding: 0;
			border: 1px solid var(--color-border);
			background: transparent;
			color: var(--color-text-muted);
			cursor: pointer;
			transition: all 150ms ease;
		}

		.header__close:hover {
			border-color: var(--color-text-muted);
			color: var(--color-text-primary);
			background: var(--color-surface-raised);
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
			padding-top: var(--space-4);
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
				var(--color-surface-sunken);
			border: 1px solid var(--color-border);
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
				linear-gradient(to right, var(--zone-bracket, var(--color-border)) 0%, transparent 100%) no-repeat 0 0 / 18px 1px,
				linear-gradient(to bottom, var(--zone-bracket, var(--color-border)) 0%, transparent 100%) no-repeat 0 0 / 1px 18px,
				linear-gradient(to left, var(--zone-bracket, var(--color-border)) 0%, transparent 100%) no-repeat 100% 100% / 18px 1px,
				linear-gradient(to top, var(--zone-bracket, var(--color-border)) 0%, transparent 100%) no-repeat 100% 100% / 1px 18px;
		}

		.zone::after {
			background:
				linear-gradient(to left, var(--zone-bracket, var(--color-border)) 0%, transparent 100%) no-repeat 100% 0 / 18px 1px,
				linear-gradient(to bottom, var(--zone-bracket, var(--color-border)) 0%, transparent 100%) no-repeat 100% 0 / 1px 18px,
				linear-gradient(to right, var(--zone-bracket, var(--color-border)) 0%, transparent 100%) no-repeat 0 100% / 18px 1px,
				linear-gradient(to top, var(--zone-bracket, var(--color-border)) 0%, transparent 100%) no-repeat 0 100% / 1px 18px;
		}

		/* Empty: awaiting card */
		.zone--empty {
			--zone-bracket: color-mix(in srgb, var(--color-epoch-accent) 40%, var(--color-border));
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
				drop-shadow(0 0 16px var(--color-primary-border))
				drop-shadow(0 20px 40px rgba(0 0 0 / 0.7));
		}

		.zone--filled::before,
		.zone--filled::after {
			opacity: 0;
		}

		/* Locked: powered-down bay */
		.zone--locked {
			border-color: var(--color-surface);
			background:
				repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255 255 255 / 0.008) 4px, rgba(255 255 255 / 0.008) 5px),
				linear-gradient(180deg, rgba(0 0 0 / 0.5), rgba(0 0 0 / 0.3)),
				var(--color-surface-sunken);
			box-shadow: inset 0 2px 12px rgba(0 0 0 / 0.7);
			animation: none;
		}

		.zone--locked::before,
		.zone--locked::after {
			--zone-bracket: var(--color-border);
			opacity: 0.4;
		}

		.zone--locked .zone__label {
			color: var(--color-surface-raised);
		}

		/* Active-target: pulsing amber energy */
		.zone--active-target {
			--zone-bracket: var(--color-epoch-accent);
			border-color: var(--color-epoch-accent);
			border-style: solid;
			animation: zone-pulse 1.5s ease-in-out infinite;
		}

		.zone--dragover {
			border-color: var(--color-epoch-accent);
			border-style: solid;
			box-shadow: 0 0 16px color-mix(in srgb, var(--color-primary) 20%, transparent), inset 0 0 12px color-mix(in srgb, var(--color-primary) 6%, transparent);
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
			border: 1.5px solid var(--color-border);
			background: transparent;
			transition: all 200ms ease;
		}

		.counter-pip--filled {
			border-color: var(--color-epoch-accent);
			background: var(--color-epoch-accent);
			animation: pip-flip 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
		}

		@keyframes pip-flip {
			0% { transform: scale(0.3) rotateY(90deg); }
			50% { transform: scale(1.3) rotateY(0deg); }
			100% { transform: scale(1) rotateY(0deg); }
		}

		@keyframes slot-breathe {
			from {
				border-color: var(--color-border);
				box-shadow:
					inset 0 2px 8px rgba(0 0 0 / 0.6),
					inset 0 0 1px rgba(255 255 255 / 0.03),
					0 1px 0 rgba(255 255 255 / 0.02);
			}
			to {
				border-color: color-mix(in srgb, var(--color-epoch-accent) 25%, var(--color-surface-raised));
				box-shadow:
					inset 0 2px 8px rgba(0 0 0 / 0.6),
					inset 0 0 12px color-mix(in srgb, var(--color-primary) 4%, transparent),
					0 0 8px color-mix(in srgb, var(--color-primary) 6%, transparent),
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
					inset 0 0 20px color-mix(in srgb, var(--color-primary) 6%, transparent),
					0 0 0 0 var(--color-primary-border);
			}
			50% {
				box-shadow:
					inset 0 2px 8px rgba(0 0 0 / 0.6),
					inset 0 0 30px color-mix(in srgb, var(--color-primary) 10%, transparent),
					0 0 24px 4px color-mix(in srgb, var(--color-primary) 12%, transparent);
			}
		}

		/* Zone label: military stencil */
		.zone__label {
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.2em;
			color: var(--color-text-muted);
			margin-bottom: var(--space-1);
			text-shadow: 0 1px 2px rgba(0 0 0 / 0.5);
		}

		.zone__hint {
			font-family: var(--font-mono, monospace);
			font-size: 9px;
			color: var(--color-icon);
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
			color: var(--color-epoch-accent);
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
			border: 1px solid var(--color-border);
			border-radius: 50%;
			background: var(--color-surface);
			color: var(--color-text-muted);
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
			background: var(--color-surface-raised);
		}

		/* Shockwave ring */
		.slam-ring {
			position: absolute;
			inset: 0;
			border: 2px solid var(--slam-ring-color, var(--color-epoch-accent));
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
		.zone__fit--fair { color: var(--color-epoch-accent); border-color: var(--color-epoch-accent); }
		.zone__fit--poor { color: var(--color-danger); border-color: var(--color-danger); }

		/* ── Arrow connectors ── */
		.arrow {
			flex-shrink: 0;
			color: var(--color-surface-raised);
			transition: color 300ms;
		}

		.arrow--active {
			color: var(--color-epoch-accent);
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
			background: var(--color-surface-raised);
			position: relative;
			overflow: hidden;
		}

		.wire-bar__line--active::after {
			content: '';
			position: absolute;
			inset: 0;
			background: var(--color-epoch-accent);
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
			color: var(--color-icon);
			white-space: nowrap;
		}

		.wire-bar__status--ready {
			color: var(--color-epoch-accent);
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
			isolation: isolate;
		}

		.mission-grid velg-mission-card {
			position: relative;
			z-index: 1;
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
				drop-shadow(0 0 18px color-mix(in srgb, var(--color-primary) 35%, transparent))
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
		.target-card--high   { --zone-accent: var(--color-danger); }
		.target-card--medium { --zone-accent: var(--color-primary); }
		.target-card--low    { --zone-accent: var(--color-success); }

		.target-card {
			appearance: none;
			font: inherit;
			text-align: start;
			padding: 0;
			--_accent: var(--zone-accent, var(--color-border));
			position: relative;
			flex-shrink: 0;
			width: 168px;
			height: 120px;
			border: 1px solid var(--color-border);
			border-radius: 6px;
			background:
				linear-gradient(175deg, rgba(255 255 255 / 0.02) 0%, transparent 40%),
				linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-sunken) 100%);
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
				linear-gradient(to right, var(--color-border) 0%, transparent 100%) no-repeat 0 0 / 14px 1px,
				linear-gradient(to bottom, var(--color-border) 0%, transparent 100%) no-repeat 0 0 / 1px 14px,
				/* TR */
				linear-gradient(to left, var(--color-border) 0%, transparent 100%) no-repeat 100% 0 / 14px 1px,
				linear-gradient(to bottom, var(--color-border) 0%, transparent 100%) no-repeat 100% 0 / 1px 14px,
				/* BL */
				linear-gradient(to right, var(--color-border) 0%, transparent 100%) no-repeat 0 100% / 14px 1px,
				linear-gradient(to top, var(--color-border) 0%, transparent 100%) no-repeat 0 100% / 1px 14px,
				/* BR */
				linear-gradient(to left, var(--color-border) 0%, transparent 100%) no-repeat 100% 100% / 14px 1px,
				linear-gradient(to top, var(--color-border) 0%, transparent 100%) no-repeat 100% 100% / 1px 14px;
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
			color: var(--color-text-secondary);
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
			border-color: color-mix(in srgb, var(--_accent) 50%, var(--color-border));
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
			color: var(--color-text-primary);
		}

		/* ─── Selected: amber border + inner glow ─── */
		.target-card--selected {
			border-color: var(--color-epoch-accent);
			background:
				linear-gradient(175deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 0%, transparent 40%),
				linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-sunken) 100%);
			box-shadow:
				inset 0 0 24px var(--color-primary-bg),
				inset 0 1px 0 rgba(255 255 255 / 0.04),
				0 0 12px var(--color-primary-glow),
				0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
		}

		.target-card--selected::before {
			background: linear-gradient(
				90deg,
				transparent 0%,
				var(--color-epoch-accent) 10%,
				var(--color-epoch-accent) 90%,
				transparent 100%
			);
			opacity: 1;
			height: 4px;
		}

		.target-card--selected::after {
			background:
				linear-gradient(to right, var(--color-epoch-accent) 0%, transparent 100%) no-repeat 0 0 / 16px 1px,
				linear-gradient(to bottom, var(--color-epoch-accent) 0%, transparent 100%) no-repeat 0 0 / 1px 16px,
				linear-gradient(to left, var(--color-epoch-accent) 0%, transparent 100%) no-repeat 100% 0 / 16px 1px,
				linear-gradient(to bottom, var(--color-epoch-accent) 0%, transparent 100%) no-repeat 100% 0 / 1px 16px,
				linear-gradient(to right, var(--color-epoch-accent) 0%, transparent 100%) no-repeat 0 100% / 16px 1px,
				linear-gradient(to top, var(--color-epoch-accent) 0%, transparent 100%) no-repeat 0 100% / 1px 16px,
				linear-gradient(to left, var(--color-epoch-accent) 0%, transparent 100%) no-repeat 100% 100% / 16px 1px,
				linear-gradient(to top, var(--color-epoch-accent) 0%, transparent 100%) no-repeat 100% 100% / 1px 16px;
		}

		.target-card--selected .target-card__name {
			color: var(--color-epoch-accent);
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
			border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
			border-left: 3px solid var(--color-epoch-accent);
			background:
				linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 0%, transparent 60%),
				var(--color-surface);
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
				color-mix(in srgb, var(--color-primary) 4%, transparent) 40%,
				var(--color-primary-bg) 50%,
				color-mix(in srgb, var(--color-primary) 4%, transparent) 60%,
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
			color: var(--color-epoch-accent);
			padding: 2px 8px;
			border: 1px solid var(--color-primary-border);
			background: var(--color-primary-bg);
			white-space: nowrap;
			flex-shrink: 0;
		}

		.target-section__header-name {
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: 13px;
			text-transform: uppercase;
			letter-spacing: 0.15em;
			color: var(--color-text-primary);
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
			border-top: 2px solid var(--zone-accent, var(--color-border));
			background:
				linear-gradient(180deg, color-mix(in srgb, var(--zone-accent, var(--color-border)) 6%, transparent) 0%, transparent 100%);
		}

		.target-zone-col__header-name {
			font-family: var(--font-brutalist);
			font-weight: 800;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--color-text-tertiary);
		}

		.target-zone-col__header-sec {
			font-family: var(--font-mono, monospace);
			font-size: 8px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--zone-accent, var(--color-text-muted));
		}

		/* Buildings sub-list within zone column */
		.target-zone-col__buildings {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			padding-left: var(--space-2);
			border-left: 1px solid var(--color-border);
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
			border: 1px solid var(--color-border);
			background: var(--color-surface);
			margin-bottom: var(--space-3);
			width: 100%;
			max-width: 600px;
		}

		.embassy-bar__label {
			font-family: var(--font-mono, monospace);
			font-size: 9px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--color-text-muted);
			white-space: nowrap;
		}

		.embassy-bar__select {
			flex: 1;
			font-family: var(--font-mono, monospace);
			font-size: var(--text-xs);
			padding: var(--space-1) var(--space-2);
			border: 1px solid var(--color-border);
			background: var(--color-surface-sunken);
			color: var(--color-text-primary);
			cursor: pointer;
		}

		.embassy-bar__select:focus {
			outline: none;
			border-color: var(--color-epoch-accent);
		}

		/* ══════════════════════════════════════════════════
		   TARGETING RING (success probability)
		   ══════════════════════════════════════════════════ */
		.targeting {
			display: flex;
			align-items: center;
			gap: var(--space-4);
			padding: var(--space-3);
			border: 1px solid var(--color-border);
			background: var(--color-surface);
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
			stroke: var(--color-border);
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
		.targeting__pct--amber { color: var(--color-epoch-accent); }
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
			color: var(--color-text-muted);
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
			color: var(--color-icon);
		}

		.hand__cards {
			display: flex;
			justify-content: center;
			position: relative;
		}

		.hand__card-wrapper {
			appearance: none;
			border: 0;
			background: none;
			font: inherit;
			text-align: start;
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
			padding: 100px 30px 10px;
			margin-top: -100px;
			margin-bottom: -10px;
		}

		.hand__card-wrapper:first-child {
			margin-left: 0;
		}

		/* Scale the card INSIDE the wrapper, not the wrapper itself */
		.hand__card-wrapper velg-game-card {
			transition:
				transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1) 60ms,
				filter 250ms ease 60ms;
			transform-origin: bottom center;
		}

		.hand__card-wrapper:hover {
			z-index: 20;
		}

		.hand__card-wrapper:hover velg-game-card {
			transform: translateY(-30px) rotateZ(0deg) scale(1.4);
			transition-delay: 0ms;
			filter:
				drop-shadow(0 0 16px color-mix(in srgb, var(--color-primary) 35%, transparent))
				drop-shadow(0 0 36px var(--color-primary-glow))
				drop-shadow(0 20px 40px rgba(0 0 0 / 0.7));
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
		   AGENT DETAIL STRIP — aptitude readout
		   ══════════════════════════════════════════════════ */
		/* ── Agent Detail Strip ── */
		.agent-detail-slot {
			width: 100%;
			max-width: 520px;
			min-height: 42px;
			flex-shrink: 0;
			z-index: var(--z-raised);
			position: relative;
			margin-bottom: var(--space-2);
		}

		.agent-detail-slot__hint {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 42px;
			font-family: var(--font-mono, monospace);
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--color-icon);
			border: 1px dashed var(--color-border);
		}

		.agent-detail {
			display: flex;
			align-items: center;
			gap: var(--space-4);
			padding: var(--space-2) var(--space-4);
			background:
				linear-gradient(90deg, rgba(255 255 255 / 0.02) 0%, transparent 60%),
				var(--color-surface);
			border: 1px solid var(--color-border);
			border-left: 3px solid var(--agent-accent, var(--color-epoch-accent));
			animation: detail-fade-in 200ms ease both;
		}

		@keyframes detail-fade-in {
			from { opacity: 0; }
			to { opacity: 1; }
		}

		.agent-detail__identity {
			display: flex;
			align-items: center;
			gap: var(--space-2);
			flex-shrink: 0;
		}

		.agent-detail__name {
			font-family: var(--font-brutalist);
			font-weight: 900;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--color-text-primary);
			white-space: nowrap;
		}

		.agent-detail__bars {
			flex: 1;
			min-width: 0;
			max-width: 280px;
		}

		.agent-detail__fit {
			flex-shrink: 0;
			font-family: var(--font-mono, monospace);
			font-size: 10px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			padding: 2px 8px;
			border: 1px solid;
		}

		.agent-detail__fit--good {
			color: var(--color-success);
			border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
			background: color-mix(in srgb, var(--color-success) 8%, transparent);
		}

		.agent-detail__fit--fair {
			color: var(--color-warning);
			border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
			background: color-mix(in srgb, var(--color-warning) 8%, transparent);
		}

		.agent-detail__fit--poor {
			color: var(--color-danger, var(--color-danger));
			border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
			background: color-mix(in srgb, var(--color-danger) 8%, transparent);
		}

		@media (max-width: 768px) {
			.agent-detail {
				flex-direction: column;
				align-items: stretch;
				gap: var(--space-2);
			}

			.agent-detail__bars {
				max-width: none;
			}

			.agent-detail-slot {
				max-width: none;
			}
		}

		@media (prefers-reduced-motion: reduce) {
			.agent-detail {
				animation: none;
			}
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
			border-top: 2px solid var(--color-border);
			background: var(--color-surface);
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
			color: var(--color-text-muted);
			border-color: var(--color-border);
			background: transparent;
		}

		.footer__btn--cancel:hover:not(:disabled) {
			border-color: var(--color-text-muted);
			background: var(--color-surface-raised);
		}

		.footer__btn--deploy {
			color: var(--color-text-inverse);
			border-color: var(--color-epoch-accent);
			background: var(--color-epoch-accent);
			position: relative;
			overflow: hidden;
		}

		.footer__btn--deploy:hover:not(:disabled) {
			box-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 40%, transparent),
				0 0 40px var(--color-primary-glow);
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
			0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 40%, transparent); }
			50% { box-shadow: 0 0 20px 4px var(--color-primary-border); }
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
			border: 1px solid var(--color-danger-border);
			background: var(--color-danger-bg);
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
			background: var(--color-surface-inverse);
			opacity: 0;
			pointer-events: none;
			z-index: var(--z-sticky);
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
			color: var(--color-epoch-accent);
			border: 4px solid var(--color-epoch-accent);
			padding: var(--space-2) var(--space-5);
			white-space: nowrap;
			opacity: 0;
			pointer-events: none;
			z-index: var(--z-header);
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
				scrollbar-color: var(--color-border) transparent;
			}

			.hand__card-wrapper {
				margin-left: 0;
				transform: none !important;
				flex-shrink: 0;
				padding: 0;
				margin-top: 0;
				margin-bottom: 0;
			}

			/* Shrink cards to xs size on mobile */
			.hand__card-wrapper velg-game-card {
				--card-w: 80px;
				--card-h: 128px;
				transition: transform 200ms ease;
			}

			.hand__card-wrapper:hover velg-game-card {
				transform: translateY(-4px) scale(1.02);
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
