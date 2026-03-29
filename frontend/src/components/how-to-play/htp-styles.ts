/**
 * How-to-Play shared styles — extracted from HowToPlayView.ts.
 *
 * Dark military-console aesthetic: scan-line textures, terminal readouts,
 * brutalist headings, monospace data tables. CRT-era tactical briefing look.
 */

import { css } from 'lit';

export const htpStyles = css`
  /* ═══ HOST ═══════════════════════════════════════ */

  :host {
    display: block;
    min-height: 100vh;
    background: var(--color-surface-sunken);
    color: var(--color-text-secondary);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* ═══ HERO ═══════════════════════════════════════ */

  .hero {
    position: relative;
    border-bottom: 3px solid var(--color-border-light);
    overflow: hidden;
  }

  .hero__scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255 255 255 / 0.015) 2px,
      rgba(255 255 255 / 0.015) 4px
    );
    pointer-events: none;
  }

  .hero__inner {
    position: relative;
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-16) var(--space-6) var(--space-10);
    text-align: center;
  }

  .hero__classification {
    display: inline-block;
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-danger);
    border: 2px solid var(--color-danger);
    padding: var(--space-0-5) var(--space-3);
    margin-bottom: var(--space-6);
    opacity: 0;
    animation: fade-down 0.6s var(--ease-dramatic) 0.1s forwards;
  }

  .hero__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: clamp(2rem, 6vw, var(--text-4xl));
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-3);
    opacity: 0;
    animation: fade-down 0.6s var(--ease-dramatic) 0.25s forwards;
  }

  .hero__sub {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-base);
    color: var(--color-text-muted);
    letter-spacing: var(--tracking-wider);
    text-transform: uppercase;
    margin: 0;
    opacity: 0;
    animation: fade-down 0.6s var(--ease-dramatic) 0.4s forwards;
  }

  .hero__line {
    width: 80px;
    height: 2px;
    background: var(--color-border);
    margin: var(--space-6) auto 0;
    opacity: 0;
    animation: scale-x 0.6s var(--ease-dramatic) 0.55s forwards;
  }

  @keyframes fade-down {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes scale-x {
    from { opacity: 0; transform: scaleX(0); }
    to   { opacity: 1; transform: scaleX(1); }
  }

  /* ═══ LAYOUT ═════════════════════════════════════ */

  .layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    max-width: 1200px;
    margin: 0 auto;
    gap: 0;
  }

  @media (min-width: 1440px) {
    .layout { max-width: 1400px; }
  }

  /* ═══ TOC SIDEBAR ════════════════════════════════ */

  .toc {
    position: sticky;
    top: 0;
    height: 100vh;
    padding: var(--space-8) var(--space-4) var(--space-8) var(--space-6);
    border-right: 1px solid var(--color-border-light);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .toc__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
    margin: 0 0 var(--space-4);
  }

  .toc__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .toc__link {
    display: block;
    padding: var(--space-1-5) var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-text-muted);
    text-decoration: none;
    border-left: 2px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toc__link:hover {
    color: var(--color-text-tertiary);
    border-left-color: var(--color-border);
  }

  .toc__link:focus-visible {
    outline: 2px solid var(--color-warning);
    outline-offset: -2px;
  }

  .toc__link--active {
    color: var(--color-text-primary);
    border-left-color: var(--color-warning);
    background: var(--color-ascendant-gold);
  }

  /* ═══ MAIN CONTENT ═══════════════════════════════ */

  .content {
    padding: var(--space-8) var(--space-8) var(--space-16);
    min-width: 0;
  }

  /* ═══ SECTIONS ═══════════════════════════════════ */

  .section {
    margin-bottom: var(--space-16);
    scroll-margin-top: var(--space-4);
  }

  .section__divider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }

  .section__number {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: 11px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .section__rule {
    flex: 1;
    height: 1px;
    background: var(--color-border-light);
  }

  .section__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-xl);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-4);
  }

  .section__text {
    color: var(--color-text-muted);
    line-height: var(--leading-relaxed);
    max-width: 65ch;
  }

  /* ═══ PHASE STEPPER ══════════════════════════════ */

  .phases {
    display: flex;
    align-items: flex-start;
    gap: 0;
    margin: var(--space-6) 0;
    overflow-x: auto;
    padding-bottom: var(--space-4);
  }

  .phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 120px;
    flex: 1;
    position: relative;
  }

  .phase__dot-row {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
  }

  .phase__track {
    flex: 1;
    height: 2px;
    background: var(--color-border);
  }

  .phase__track--hidden {
    visibility: hidden;
  }

  .phase__dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }

  .phase__name {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    margin-top: var(--space-2);
    text-align: center;
  }

  .phase__desc {
    font-size: 10px;
    color: var(--color-text-muted);
    text-align: center;
    margin-top: var(--space-1);
    padding: 0 var(--space-1);
    line-height: 1.4;
  }

  /* ═══ RP DATA READOUT ════════════════════════════ */

  .readout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--color-border-light);
    border: 1px solid var(--color-border-light);
    margin: var(--space-4) 0;
    max-width: 500px;
  }

  .readout__cell {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
  }

  .readout__label {
    color: var(--color-text-muted);
    font-size: 11px;
  }

  .readout__value {
    color: var(--color-warning);
    font-weight: var(--font-bold);
    font-size: 11px;
  }

  /* ═══ OPERATIVE CARDS ════════════════════════════ */

  .ops-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin: var(--space-6) 0;
  }

  .op-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-left: 4px solid;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    opacity: 0;
    animation: card-in var(--duration-entrance, 350ms) var(--ease-dramatic) forwards;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
  }

  @keyframes card-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .op-card__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .op-card__name {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-md);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
  }

  .op-card__cost {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-2xl);
    line-height: 1;
  }

  .op-card__cost-label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    margin-left: 2px;
  }

  .op-card__stats {
    display: flex;
    gap: var(--space-4);
  }

  .op-card__stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .op-card__stat-label {
    font-size: 9px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .op-card__stat-value {
    font-weight: var(--font-bold);
    color: var(--color-text-tertiary);
    font-size: var(--text-sm);
  }

  .op-card__desc {
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
  }

  .op-card__effect {
    font-size: 11px;
    color: var(--color-text-tertiary);
    padding: var(--space-2);
    background: rgba(255 255 255 / 0.03);
    border-left: 2px solid var(--color-border);
  }

  /* ═══ TACTICS CARDS ═════════════════════════════ */

  .tactics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin: var(--space-6) 0;
  }

  .tactic-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-left: 4px solid;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    opacity: 0;
    animation: card-in var(--duration-entrance, 350ms) var(--ease-dramatic) forwards;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
  }

  .tactic-card--opener   { border-left-color: var(--color-success); }
  .tactic-card--timing   { border-left-color: var(--color-warning); }
  .tactic-card--economy  { border-left-color: var(--color-info); }
  .tactic-card--counter  { border-left-color: var(--color-danger); }
  .tactic-card--preset   { border-left-color: var(--color-text-muted); }

  .tactic-card__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .tactic-card__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
  }

  .tactic-card__badge {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    padding: 1px 6px;
    flex-shrink: 0;
  }

  .tactic-card__badge--opener   { color: var(--color-success); border: 1px solid var(--color-success); }
  .tactic-card__badge--timing   { color: var(--color-warning); border: 1px solid var(--color-warning); }
  .tactic-card__badge--economy  { color: var(--color-info); border: 1px solid var(--color-info); }
  .tactic-card__badge--counter  { color: var(--color-danger); border: 1px solid var(--color-danger); }
  .tactic-card__badge--preset   { color: var(--color-text-muted); border: 1px solid var(--color-text-muted); }

  .tactic-card__desc {
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.6;
  }

  /* ═══ SCORING ════════════════════════════════════ */

  .dim-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: var(--space-4) 0;
    max-width: 500px;
  }

  .dim-row {
    display: grid;
    grid-template-columns: 100px 1fr 40px;
    align-items: center;
    gap: var(--space-3);
  }

  .dim-row__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .dim-row__bar {
    height: 8px;
    background: var(--color-border-light);
    position: relative;
    overflow: hidden;
  }

  .dim-row__fill {
    position: absolute;
    inset: 0;
    transform-origin: left;
    transform: scaleX(var(--w, 0));
    transition: transform 0.8s var(--ease-dramatic);
  }

  .dim-row__value {
    font-size: 10px;
    color: var(--color-text-muted);
    text-align: right;
  }

  .presets-table {
    width: 100%;
    max-width: 600px;
    border-collapse: collapse;
    margin: var(--space-4) 0;
  }

  .presets-table th {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    text-align: center;
    padding: var(--space-2);
    border-bottom: 2px solid var(--color-border-light);
  }

  .presets-table th:first-child {
    text-align: left;
  }

  .presets-table td {
    font-size: 11px;
    text-align: center;
    padding: var(--space-2);
    border-bottom: 1px solid var(--color-border-light);
    color: var(--color-text-tertiary);
  }

  .presets-table td:first-child {
    text-align: left;
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
  }

  .formula {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    color: var(--color-info);
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    padding: var(--space-3) var(--space-4);
    margin: var(--space-4) 0;
    overflow-x: auto;
    white-space: nowrap;
  }

  /* ═══ CALLOUT BOXES ══════════════════════════════ */

  .callout {
    border-left: 4px solid;
    padding: var(--space-4);
    margin: var(--space-4) 0;
    background: rgba(255 255 255 / 0.02);
  }

  .callout--tip    { border-left-color: var(--color-success); }
  .callout--warn   { border-left-color: var(--color-warning); }
  .callout--danger { border-left-color: var(--color-danger); }
  .callout--info   { border-left-color: var(--color-info); }

  .callout__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    margin-bottom: var(--space-2);
  }

  .callout--tip    .callout__label { color: var(--color-success); }
  .callout--warn   .callout__label { color: var(--color-warning); }
  .callout--danger .callout__label { color: var(--color-danger); }
  .callout--info   .callout__label { color: var(--color-info); }

  .callout__text {
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.6;
  }

  /* ═══ MATCH CARDS ════════════════════════════════ */

  .match {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    margin-bottom: var(--space-6);
  }

  .match__header {
    appearance: none;
    font: inherit;
    text-align: start;
    background: none;
    border: none;
    color: inherit;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border-light);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .match__header:hover {
    background: rgba(255 255 255 / 0.02);
  }

  .match__header:focus-visible {
    outline: 2px solid var(--color-warning);
    outline-offset: -2px;
  }

  .match__title-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .match__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-md);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
    margin: 0;
  }

  .match__subtitle {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .match__meta {
    display: flex;
    gap: var(--space-4);
    flex-shrink: 0;
  }

  .match__meta-tag {
    font-size: 10px;
    color: var(--color-text-muted);
    padding: var(--space-0-5) var(--space-2);
    border: 1px solid var(--color-border);
  }

  .match__toggle {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    transition: transform var(--transition-fast);
  }

  .match__toggle--open {
    transform: rotate(180deg);
  }

  .match__body {
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .match__desc {
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.6;
  }

  .match__players {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .match__player {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    padding: var(--space-0-5) var(--space-2);
    border: 1px solid var(--color-border);
    color: var(--color-text-tertiary);
  }

  /* ── Cycle Table ─────────── */

  .cycles-label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    margin-bottom: var(--space-2);
  }

  .cycles-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .cycles-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 550px;
  }

  .cycles-table th {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    text-align: left;
    padding: var(--space-1-5) var(--space-2);
    border-bottom: 2px solid var(--color-border-light);
  }

  .cycles-table td {
    font-size: 11px;
    padding: var(--space-1-5) var(--space-2);
    border-bottom: 1px solid var(--color-border-light);
    color: var(--color-text-tertiary);
    vertical-align: top;
  }

  .cycles-table tr:nth-child(even) td {
    background: rgba(255 255 255 / 0.01);
  }

  .cycle-phase {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 9px;
    text-transform: uppercase;
    padding: 1px 4px;
  }

  .cycle-phase--foundation { color: var(--color-success); }
  .cycle-phase--competition { color: var(--color-warning); }
  .cycle-phase--reckoning { color: var(--color-danger); }

  .outcome--success  { color: var(--color-success); }
  .outcome--detected { color: var(--color-danger); }
  .outcome--failed   { color: var(--color-text-muted); }

  .cycle-note {
    font-size: 10px;
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* ── Standings ────────────── */

  .standings-label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    margin-bottom: var(--space-2);
  }

  .standings-table {
    width: 100%;
    border-collapse: collapse;
  }

  .standings-table th {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    text-align: center;
    padding: var(--space-1-5) var(--space-2);
    border-bottom: 2px solid var(--color-border-light);
  }

  .standings-table th:first-child,
  .standings-table th:nth-child(2) { text-align: left; }

  .standings-table td {
    font-size: 11px;
    text-align: center;
    padding: var(--space-1-5) var(--space-2);
    border-bottom: 1px solid var(--color-border-light);
    color: var(--color-text-tertiary);
  }

  .standings-table td:first-child,
  .standings-table td:nth-child(2) { text-align: left; }

  .standings-rank {
    font-weight: var(--font-black);
  }

  .standings-rank--1 { color: var(--color-warning); }
  .standings-rank--2 { color: var(--color-text-muted); }
  .standings-rank--3 { color: var(--color-warning-hover); }

  .standings-title {
    font-size: 9px;
    color: var(--color-warning);
    font-style: italic;
  }

  .standings-composite {
    font-weight: var(--font-black);
    color: var(--color-text-primary);
  }

  /* ── Key Moments ─────────── */

  .moments-label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    margin-bottom: var(--space-2);
  }

  .moments-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .moments-list li {
    padding-left: var(--space-4);
    position: relative;
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .moments-list li::before {
    content: '\\25B8';
    position: absolute;
    left: 0;
    color: var(--color-warning);
  }

  /* ═══ VECTOR GRID ═══════════════════════════════ */

  .vector-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin: var(--space-6) 0;
  }

  .vector-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-left: 4px solid;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    opacity: 0;
    animation: card-in var(--duration-entrance, 350ms) var(--ease-dramatic) forwards;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
  }

  .vector-card__name {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
  }

  .vector-card__desc {
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
  }

  .vector-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .vector-tag {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    padding: 1px 5px;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }

  /* ═══ DIMENSION FORMULAS ═════════════════════════ */

  .dim-block {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-left: 4px solid;
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }

  .dim-block__header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }

  .dim-block__name {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-primary);
  }

  .dim-title {
    font-size: 10px;
    font-style: italic;
    padding: 1px 6px;
    border: 1px solid;
    opacity: 0.8;
  }

  .dim-block__formula {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm);
    color: var(--color-info);
    margin-bottom: var(--space-2);
  }

  .dim-block__explanation {
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
  }

  /* ═══ LIFECYCLE STEPS ═══════════════════════════ */

  .lifecycle {
    display: flex;
    align-items: center;
    gap: 0;
    margin: var(--space-4) 0;
    flex-wrap: wrap;
  }

  .lifecycle__step {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .lifecycle__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .lifecycle__name {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .lifecycle__arrow {
    color: var(--color-text-muted);
    font-size: 10px;
    margin: 0 var(--space-2);
  }

  /* ═══ ANALYTICS: ELO CHART ══════════════════════ */

  .analytics-sub {
    margin-bottom: var(--space-8);
  }

  .analytics-sub__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-md);
    text-transform: uppercase;
    letter-spacing: var(--tracking-brutalist);
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-2);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border-light);
  }

  .analytics-sub__desc {
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
    margin-bottom: var(--space-4);
  }

  .elo-chart {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: var(--space-4) 0;
  }

  .elo-row {
    display: grid;
    grid-template-columns: 140px 1fr 55px 45px;
    align-items: center;
    gap: var(--space-3);
  }

  .elo-row__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .elo-row__track {
    height: 12px;
    background: var(--color-border-light);
    position: relative;
    overflow: hidden;
  }

  .elo-row__fill {
    position: absolute;
    inset: 0;
    transform-origin: left;
    transform: scaleX(var(--w, 0));
    transition: transform 1s var(--ease-dramatic);
    opacity: 0.8;
  }

  .elo-row__fill::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: rgba(255 255 255 / 0.4);
  }

  .elo-row__value {
    font-family: var(--font-mono, monospace);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    text-align: right;
  }

  .elo-row__delta {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-align: right;
  }

  .elo-row__delta--up { color: var(--color-success); }
  .elo-row__delta--down { color: var(--color-danger); }

  /* ═══ ANALYTICS: SIMULATION PROFILES ═════════════ */

  .profile-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin: var(--space-4) 0;
  }

  .profile-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-top: 3px solid;
    opacity: 0;
    animation: card-in var(--duration-entrance, 350ms) var(--ease-dramatic) forwards;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
  }

  .profile-card__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-light);
  }

  .profile-card__tag {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-lg);
    min-width: 36px;
    text-align: center;
    padding: var(--space-0-5) var(--space-1);
    border: 2px solid;
    line-height: 1;
  }

  .profile-card__name {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
    flex: 1;
  }

  .profile-card__elo {
    font-family: var(--font-mono, monospace);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
  }

  .profile-card__body {
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .profile-card__rates {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .profile-card__rate {
    text-align: center;
  }

  .profile-card__rate-label {
    font-size: 9px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    display: block;
    margin-bottom: 2px;
  }

  .profile-card__rate-value {
    font-family: var(--font-mono, monospace);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .profile-card__rate-value--na {
    color: var(--color-text-muted);
    font-size: 10px;
  }

  .profile-card__ci {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 10px;
  }

  .profile-card__ci-label {
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 9px;
    flex-shrink: 0;
    min-width: 40px;
  }

  .profile-card__ci-track {
    flex: 1;
    height: 6px;
    background: var(--color-border-light);
    position: relative;
  }

  .profile-card__ci-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    opacity: 0.5;
  }

  .profile-card__ci-range {
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .profile-card__text {
    font-size: 11px;
    line-height: 1.5;
  }

  .profile-card__text-label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    margin-right: var(--space-1);
  }

  .profile-card__text-value {
    color: var(--color-text-muted);
  }

  /* ═══ ANALYTICS: STRATEGY TIERS ═════════════════ */

  .strat-tiers {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin: var(--space-4) 0;
  }

  .strat-tier {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: var(--space-3);
    align-items: start;
  }

  .strat-tier__badge {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-xl);
    text-align: center;
    line-height: 1;
    padding: var(--space-1) 0;
    border: 2px solid;
  }

  .strat-tier__entries {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .strat-entry {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    padding: var(--space-2) var(--space-3);
  }

  .strat-entry__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .strat-entry__name {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
  }

  .strat-entry__meta {
    display: flex;
    gap: var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .strat-entry__bar {
    height: 6px;
    background: var(--color-border-light);
    position: relative;
    margin-bottom: var(--space-1);
  }

  .strat-entry__fill {
    position: absolute;
    inset: 0;
    transform-origin: left;
    transform: scaleX(var(--w, 0));
    transition: transform 0.8s var(--ease-dramatic);
  }

  .strat-entry__desc {
    font-size: 10px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  /* ═══ ANALYTICS: DIMENSION IMPACT ═══════════════ */

  .impact-chart {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: var(--space-4) 0;
  }

  .impact-row {
    display: grid;
    grid-template-columns: 100px 1fr 60px 70px;
    align-items: center;
    gap: var(--space-3);
  }

  .impact-row__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .impact-row__track {
    height: 10px;
    background: var(--color-border-light);
    position: relative;
    overflow: hidden;
  }

  .impact-row__fill {
    position: absolute;
    inset: 0;
    transform-origin: left;
    transform: scaleX(var(--w, 0));
    transition: transform 0.8s var(--ease-dramatic);
    opacity: 0.75;
  }

  .impact-row__std {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-muted);
    text-align: right;
  }

  .impact-row__status {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    padding: 1px 5px;
    border: 1px solid;
    text-align: center;
  }

  /* ═══ ANALYTICS: VERDICT CARDS ══════════════════ */

  .verdict-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin: var(--space-4) 0;
  }

  .verdict-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    opacity: 0;
    animation: card-in var(--duration-entrance, 350ms) var(--ease-dramatic) forwards;
    animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
  }

  .verdict-card__label {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .verdict-card__value {
    font-family: var(--font-mono, monospace);
    font-weight: var(--font-black);
    font-size: var(--text-2xl);
    color: var(--color-text-primary);
    line-height: 1;
  }

  .verdict-card__desc {
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  /* ═══ RESPONSIVE ═════════════════════════════════ */

  @media (max-width: 768px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .toc {
      position: sticky;
      top: 0;
      z-index: var(--z-raised);
      height: auto;
      border-right: none;
      border-bottom: 1px solid var(--color-border-light);
      background: var(--color-surface-sunken);
      padding: var(--space-2) var(--space-4);
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .toc__label { display: none; }

    .toc__list {
      flex-direction: row;
      gap: 0;
    }

    .toc__link {
      border-left: none;
      border-bottom: 2px solid transparent;
      padding: var(--space-1) var(--space-2);
      font-size: 10px;
    }

    .toc__link--active {
      border-bottom-color: var(--color-warning);
      border-left-color: transparent;
      background: none;
    }

    .toc__link:hover {
      border-left-color: transparent;
    }

    .content {
      padding: var(--space-6) var(--space-4) var(--space-12);
    }

    .ops-grid,
    .tactics-grid,
    .vector-grid {
      grid-template-columns: 1fr;
    }

    .hero__inner {
      padding: var(--space-10) var(--space-4) var(--space-8);
    }

    .match__header {
      flex-direction: column;
      align-items: flex-start;
    }

    .match__meta {
      flex-wrap: wrap;
    }

    .readout {
      grid-template-columns: 1fr;
    }

    .elo-row {
      grid-template-columns: 100px 1fr 50px 40px;
    }

    .profile-card__rates {
      grid-template-columns: repeat(2, 1fr);
    }

    .verdict-grid {
      grid-template-columns: 1fr;
    }

    .impact-row {
      grid-template-columns: 80px 1fr 50px 60px;
    }

    .strat-tier {
      grid-template-columns: 32px 1fr;
    }

    .dim-row {
      grid-template-columns: 80px 1fr 30px;
    }
  }

  /* ═══ INTEL CHART CONTAINERS (ECharts) ═══════════ */

  .intel-chart {
    position: relative;
    margin: var(--space-6) 0;
    padding: var(--space-5);
    background: color-mix(in srgb, var(--color-surface) 50%, transparent);
    border: 1px solid var(--color-border-light);
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.7s var(--ease-dramatic), transform 0.7s var(--ease-dramatic);
    overflow: hidden;
  }

  .intel-chart[data-revealed] {
    opacity: 1;
    transform: translateY(0);
  }

  /* Corner bracket targeting reticle */
  .intel-chart::before,
  .intel-chart::after {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    pointer-events: none;
    z-index: 2;
  }
  .intel-chart::before {
    top: -1px;
    left: -1px;
    border-top: 2px solid var(--color-text-muted);
    border-left: 2px solid var(--color-text-muted);
  }
  .intel-chart::after {
    bottom: -1px;
    right: -1px;
    border-bottom: 2px solid var(--color-text-muted);
    border-right: 2px solid var(--color-text-muted);
  }

  /* Scan-line overlay */
  .intel-chart__scanlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 3px,
      rgba(255, 255, 255, 0.012) 3px,
      rgba(255, 255, 255, 0.012) 4px
    );
    z-index: 1;
  }

  .intel-chart__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: 1px dashed var(--color-border);
    position: relative;
    z-index: 2;
  }

  .intel-chart__classification {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: 8px;
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
    color: var(--color-warning);
    padding: 2px 6px;
    border: 1px solid var(--color-warning);
    line-height: 1.2;
    flex-shrink: 0;
  }

  .intel-chart__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-tertiary);
    flex: 1;
  }

  .intel-chart__grade {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    color: var(--color-text-muted);
    letter-spacing: var(--tracking-wide);
    flex-shrink: 0;
  }

  velg-echarts-chart {
    position: relative;
    z-index: 2;
  }

  @media (max-width: 768px) {
    .intel-chart {
      padding: var(--space-3);
    }
    .intel-chart__header {
      flex-wrap: wrap;
    }
    .intel-chart__grade {
      display: none;
    }
  }

  /* ═══ REDUCED MOTION ═════════════════════════════ */

  @media (prefers-reduced-motion: reduce) {
    .hero__classification,
    .hero__title,
    .hero__sub,
    .hero__line,
    .op-card,
    .tactic-card,
    .vector-card,
    .profile-card,
    .verdict-card {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .intel-chart {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .dim-row__fill,
    .elo-row__fill,
    .strat-entry__fill,
    .impact-row__fill {
      transition: none;
    }

    .demo-step {
      opacity: 1;
      transform: none;
    }
  }

  /* ═══ DEMO RUN ═══════════════════════════════════ */

  .demo-timeline {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-6) var(--space-2);
    margin-bottom: var(--space-8);
  }

  .demo-timeline__track {
    position: absolute;
    top: 50%;
    left: var(--space-2);
    right: var(--space-2);
    height: 2px;
    background: var(--color-border);
    transform: translateY(-50%);
    z-index: 0;
  }

  .demo-timeline__node {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    z-index: 1;
  }

  .demo-timeline__pip {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  .demo-timeline__node--lobby .demo-timeline__pip       { border-color: var(--color-text-muted); }
  .demo-timeline__node--draft .demo-timeline__pip        { border-color: var(--color-warning); }
  .demo-timeline__node--foundation .demo-timeline__pip   { border-color: var(--color-success); }
  .demo-timeline__node--competition .demo-timeline__pip  { border-color: var(--color-warning); }
  .demo-timeline__node--reckoning .demo-timeline__pip    { border-color: var(--color-danger); }
  .demo-timeline__node--completed .demo-timeline__pip    { border-color: var(--color-text-muted); }

  .demo-timeline__label {
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .demo-steps {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .demo-step {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-4);
    border-left: 2px solid var(--color-border-light);
    position: relative;
    opacity: 0;
    transform: translateY(12px);
    animation: fade-up 0.45s var(--ease-dramatic) calc(var(--i, 0) * 60ms) forwards;
  }

  .demo-step::before {
    content: '';
    position: absolute;
    left: -5px;
    top: var(--space-6);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-border);
  }

  .demo-step:hover {
    background: rgba(255 255 255 / 0.015);
  }

  .demo-step__gutter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-1);
  }

  .demo-step__index {
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--color-text-muted);
    line-height: 1;
  }

  .demo-step__phase {
    font-family: var(--font-brutalist);
    font-size: 9px;
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 2px 6px;
    border: 1px solid;
    border-radius: 2px;
    white-space: nowrap;
  }

  .demo-step__phase--lobby       { color: var(--color-text-muted); border-color: var(--color-border); }
  .demo-step__phase--draft        { color: var(--color-warning); border-color: var(--color-warning); }
  .demo-step__phase--foundation   { color: var(--color-success); border-color: var(--color-success); }
  .demo-step__phase--competition  { color: var(--color-warning); border-color: var(--color-warning); }
  .demo-step__phase--reckoning    { color: var(--color-danger); border-color: var(--color-danger); }
  .demo-step__phase--completed    { color: var(--color-text-tertiary); border-color: var(--color-text-muted); }

  .demo-step__body {
    min-width: 0;
  }

  .demo-step__title {
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-base);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2);
  }

  .demo-step__narration {
    color: var(--color-text-tertiary);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-2);
  }

  .demo-step__detail {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    line-height: var(--leading-relaxed);
    margin: 0 0 var(--space-3);
    padding-left: var(--space-3);
    border-left: 2px solid var(--color-border);
  }

  .demo-readout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1px;
    background: var(--color-border-light);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    overflow: hidden;
    margin-bottom: var(--space-2);
  }

  .demo-readout__cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
  }

  .demo-readout__label {
    font-family: var(--font-brutalist);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-muted);
  }

  .demo-readout__value {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  /* ── Demo evidence thumbnails ────────────────────── */

  .demo-evidence {
    float: right;
    width: 140px;
    margin: 0 0 var(--space-3) var(--space-4);
    padding: 6px;
    background: var(--color-border-light);
    border: 1px solid var(--color-border);
    box-shadow:
      0 2px 8px rgba(0 0 0 / 0.4),
      inset 0 0 0 1px rgba(255 255 255 / 0.03);
    cursor: pointer;
    position: relative;
    transform: rotate(-1.5deg);
    transition:
      transform 0.3s var(--ease-dramatic),
      box-shadow 0.3s var(--ease-dramatic),
      border-color 0.3s;
    outline: none;
    font-family: inherit;
    -webkit-appearance: none;
  }

  .demo-step:nth-child(even) .demo-evidence {
    transform: rotate(1.2deg);
  }

  .demo-step:nth-child(3n) .demo-evidence {
    transform: rotate(-0.8deg);
  }

  .demo-evidence:hover,
  .demo-evidence:focus-visible {
    transform: rotate(0deg) scale(1.08);
    box-shadow:
      0 8px 24px rgba(0 0 0 / 0.6),
      0 0 0 1px var(--color-epoch-accent, var(--color-warning));
    border-color: var(--color-epoch-accent, var(--color-warning));
    z-index: 2;
  }

  .demo-evidence:focus-visible {
    outline: 2px solid var(--color-epoch-accent, var(--color-warning));
    outline-offset: 2px;
  }

  .demo-evidence__img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    filter: saturate(0.7) contrast(1.1);
    transition: filter 0.3s;
  }

  .demo-evidence:hover .demo-evidence__img,
  .demo-evidence:focus-visible .demo-evidence__img {
    filter: saturate(1) contrast(1);
  }

  /* Classification stamp — top-right corner */
  .demo-evidence__stamp {
    position: absolute;
    top: 3px;
    right: 3px;
    font-family: var(--font-brutalist);
    font-size: 7px;
    font-weight: var(--font-black);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--color-danger);
    background: rgba(0 0 0 / 0.7);
    padding: 1px 4px;
    border: 1px solid var(--color-danger);
    opacity: 0.7;
    pointer-events: none;
  }

  /* Enlarge overlay — appears on hover */
  .demo-evidence__enlarge {
    position: absolute;
    inset: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--color-text-primary);
    background: rgba(0 0 0 / 0.55);
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }

  .demo-evidence:hover .demo-evidence__enlarge,
  .demo-evidence:focus-visible .demo-evidence__enlarge {
    opacity: 1;
  }

  /* Scanline overlay on hover */
  .demo-evidence::after {
    content: '';
    position: absolute;
    inset: 6px;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255 255 255 / 0.04) 2px,
      rgba(255 255 255 / 0.04) 4px
    );
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }

  .demo-evidence:hover::after,
  .demo-evidence:focus-visible::after {
    opacity: 1;
  }

  /* ── Demo responsive ─────────────────────────────── */

  @media (max-width: 640px) {
    .demo-step {
      grid-template-columns: 1fr;
      gap: var(--space-2);
      padding-left: var(--space-6);
    }

    .demo-step__gutter {
      flex-direction: row;
      gap: var(--space-3);
    }

    .demo-timeline {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: var(--space-4);
    }

    .demo-readout {
      grid-template-columns: 1fr 1fr;
    }

    .demo-evidence {
      float: none;
      width: 100%;
      max-width: 280px;
      margin: 0 0 var(--space-3) 0;
      transform: rotate(0deg);
    }

    .demo-step:nth-child(even) .demo-evidence,
    .demo-step:nth-child(3n) .demo-evidence {
      transform: rotate(0deg);
    }
  }

  @keyframes fade-up {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
