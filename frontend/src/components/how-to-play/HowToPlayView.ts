/**
 * How to Play — Classified Operations Manual
 *
 * Full-page tutorial/rulebook for the Epochs competitive layer.
 * Dark military-console aesthetic: scan-line textures, terminal readouts,
 * brutalist headings, monospace data tables. Feels like a declassified
 * tactical briefing, not a help page.
 *
 * Sticky sidebar TOC with scroll-spy. Expandable match replays.
 * Fully responsive — sidebar collapses to horizontal strip on mobile.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { getMatches } from './htp-content-matches.js';
import {
  getOperativeCards,
  getPhases,
  getRpRules,
  getScorePresets,
  getSuccessFormula,
  getTactics,
  getTocSections,
} from './htp-content-rules.js';
import type {
  CycleData,
  FinalStanding,
  MatchConfig,
  OperativeCard,
  TacticCard,
  TocSection,
} from './htp-types.js';

@localized()
@customElement('velg-how-to-play')
export class VelgHowToPlay extends LitElement {
  /* ── Styles ─────────────────────────────────────────── */

  static styles = css`
    /* ═══ HOST ═══════════════════════════════════════ */

    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-gray-950);
      color: var(--color-gray-200);
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
      border-bottom: 3px solid var(--color-gray-800);
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
      color: var(--color-gray-0);
      margin: 0 0 var(--space-3);
      opacity: 0;
      animation: fade-down 0.6s var(--ease-dramatic) 0.25s forwards;
    }

    .hero__sub {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-base);
      color: var(--color-gray-500);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      margin: 0;
      opacity: 0;
      animation: fade-down 0.6s var(--ease-dramatic) 0.4s forwards;
    }

    .hero__line {
      width: 80px;
      height: 2px;
      background: var(--color-gray-700);
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

    /* ═══ TOC SIDEBAR ════════════════════════════════ */

    .toc {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: var(--space-8) var(--space-4) var(--space-8) var(--space-6);
      border-right: 1px solid var(--color-gray-800);
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--color-gray-700) transparent;
    }

    .toc__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-gray-600);
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
      color: var(--color-gray-500);
      text-decoration: none;
      border-left: 2px solid transparent;
      cursor: pointer;
      transition: all var(--transition-fast);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toc__link:hover {
      color: var(--color-gray-300);
      border-left-color: var(--color-gray-600);
    }

    .toc__link:focus-visible {
      outline: 2px solid var(--color-warning);
      outline-offset: -2px;
    }

    .toc__link--active {
      color: var(--color-gray-100);
      border-left-color: var(--color-warning);
      background: rgba(245 158 11 / 0.05);
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
      color: var(--color-gray-600);
      flex-shrink: 0;
    }

    .section__rule {
      flex: 1;
      height: 1px;
      background: var(--color-gray-800);
    }

    .section__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-gray-0);
      margin: 0 0 var(--space-4);
    }

    .section__text {
      color: var(--color-gray-400);
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
      background: var(--color-gray-700);
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
      color: var(--color-gray-500);
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
      background: var(--color-gray-800);
      border: 1px solid var(--color-gray-800);
      margin: var(--space-4) 0;
      max-width: 500px;
    }

    .readout__cell {
      display: flex;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      background: var(--color-gray-900);
    }

    .readout__label {
      color: var(--color-gray-500);
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
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-800);
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
      color: var(--color-gray-0);
    }

    .op-card__cost {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      line-height: 1;
    }

    .op-card__cost-label {
      font-size: var(--text-xs);
      color: var(--color-gray-500);
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
      color: var(--color-gray-600);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .op-card__stat-value {
      font-weight: var(--font-bold);
      color: var(--color-gray-300);
      font-size: var(--text-sm);
    }

    .op-card__desc {
      color: var(--color-gray-400);
      font-size: 11px;
      line-height: 1.5;
    }

    .op-card__effect {
      font-size: 11px;
      color: var(--color-gray-300);
      padding: var(--space-2);
      background: rgba(255 255 255 / 0.03);
      border-left: 2px solid var(--color-gray-600);
    }

    /* ═══ TACTICS CARDS ═════════════════════════════ */

    .tactics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-4);
      margin: var(--space-6) 0;
    }

    .tactic-card {
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-800);
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
    .tactic-card--preset   { border-left-color: var(--color-gray-500); }

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
      color: var(--color-gray-0);
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
    .tactic-card__badge--preset   { color: var(--color-gray-500); border: 1px solid var(--color-gray-500); }

    .tactic-card__desc {
      color: var(--color-gray-400);
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
      background: var(--color-gray-800);
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
      color: var(--color-gray-400);
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
      color: var(--color-gray-500);
      text-align: center;
      padding: var(--space-2);
      border-bottom: 2px solid var(--color-gray-800);
    }

    .presets-table th:first-child {
      text-align: left;
    }

    .presets-table td {
      font-size: 11px;
      text-align: center;
      padding: var(--space-2);
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      color: var(--color-gray-300);
    }

    .presets-table td:first-child {
      text-align: left;
      font-weight: var(--font-bold);
      color: var(--color-gray-100);
    }

    .formula {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-info);
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-800);
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
      color: var(--color-gray-400);
      font-size: 12px;
      line-height: 1.6;
    }

    /* ═══ MATCH CARDS ════════════════════════════════ */

    .match {
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-800);
      margin-bottom: var(--space-6);
    }

    .match__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--color-gray-800);
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
      color: var(--color-gray-0);
      margin: 0;
    }

    .match__subtitle {
      font-size: 10px;
      color: var(--color-gray-500);
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
      color: var(--color-gray-400);
      padding: var(--space-0-5) var(--space-2);
      border: 1px solid var(--color-gray-700);
    }

    .match__toggle {
      font-size: var(--text-sm);
      color: var(--color-gray-500);
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
      color: var(--color-gray-400);
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
      border: 1px solid var(--color-gray-600);
      color: var(--color-gray-300);
    }

    /* ── Cycle Table ─────────── */

    .cycles-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-500);
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
      color: var(--color-gray-500);
      text-align: left;
      padding: var(--space-1-5) var(--space-2);
      border-bottom: 2px solid var(--color-gray-800);
    }

    .cycles-table td {
      font-size: 11px;
      padding: var(--space-1-5) var(--space-2);
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      color: var(--color-gray-300);
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
    .outcome--failed   { color: var(--color-gray-500); }

    .cycle-note {
      font-size: 10px;
      color: var(--color-gray-500);
      font-style: italic;
    }

    /* ── Standings ────────────── */

    .standings-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-500);
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
      color: var(--color-gray-500);
      text-align: center;
      padding: var(--space-1-5) var(--space-2);
      border-bottom: 2px solid var(--color-gray-800);
    }

    .standings-table th:first-child,
    .standings-table th:nth-child(2) { text-align: left; }

    .standings-table td {
      font-size: 11px;
      text-align: center;
      padding: var(--space-1-5) var(--space-2);
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      color: var(--color-gray-300);
    }

    .standings-table td:first-child,
    .standings-table td:nth-child(2) { text-align: left; }

    .standings-rank {
      font-weight: var(--font-black);
    }

    .standings-rank--1 { color: var(--color-warning); }
    .standings-rank--2 { color: var(--color-gray-400); }
    .standings-rank--3 { color: var(--color-warning-hover); }

    .standings-title {
      font-size: 9px;
      color: var(--color-warning);
      font-style: italic;
    }

    .standings-composite {
      font-weight: var(--font-black);
      color: var(--color-gray-100);
    }

    /* ── Key Moments ─────────── */

    .moments-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-500);
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
      color: var(--color-gray-400);
      line-height: 1.5;
    }

    .moments-list li::before {
      content: '\u25B8';
      position: absolute;
      left: 0;
      color: var(--color-warning);
    }

    /* ═══ RESPONSIVE ═════════════════════════════════ */

    @media (max-width: 768px) {
      .layout {
        grid-template-columns: 1fr;
      }

      .toc {
        position: sticky;
        top: 0;
        z-index: 10;
        height: auto;
        border-right: none;
        border-bottom: 1px solid var(--color-gray-800);
        background: var(--color-gray-950);
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
      .tactics-grid {
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

      .dim-row {
        grid-template-columns: 80px 1fr 30px;
      }
    }

    /* ═══ REDUCED MOTION ═════════════════════════════ */

    @media (prefers-reduced-motion: reduce) {
      .hero__classification,
      .hero__title,
      .hero__sub,
      .hero__line,
      .op-card,
      .tactic-card {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .dim-row__fill {
        transition: none;
      }
    }
  `;

  /* ── State ──────────────────────────────────────── */

  @state() private _activeSection = 'epochs';
  @state() private _expandedMatches = new Set<number>();

  private _observer: IntersectionObserver | null = null;

  /* ── Lifecycle ──────────────────────────────────── */

  connectedCallback() {
    super.connectedCallback();
    this.updateComplete.then(() => this._setupScrollSpy());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._observer?.disconnect();
  }

  private _setupScrollSpy() {
    const sections = this.renderRoot.querySelectorAll('.section[id]');
    if (!sections.length) return;

    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._activeSection = entry.target.id;
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );

    for (const section of sections) {
      this._observer.observe(section);
    }
  }

  private _scrollToSection(id: string) {
    const el = this.renderRoot.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private _toggleMatch(index: number) {
    const next = new Set(this._expandedMatches);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this._expandedMatches = next;
  }

  /* ── Render ─────────────────────────────────────── */

  protected render() {
    const toc = getTocSections();

    return html`
      ${this._renderHero()}

      <div class="layout">
        ${this._renderToc(toc)}

        <main class="content">
          ${this._renderEpochs()}
          ${this._renderPhases()}
          ${this._renderRp()}
          ${this._renderOperatives()}
          ${this._renderScoring()}
          ${this._renderAlliances()}
          ${this._renderBleed()}
          ${this._renderTactics()}
          ${this._renderMatches()}
        </main>
      </div>
    `;
  }

  /* ── Hero ────────────────────────────────────────── */

  private _renderHero() {
    return html`
      <div class="hero">
        <div class="hero__scanlines"></div>
        <div class="hero__inner">
          <div class="hero__classification">${msg('Eyes Only')}</div>
          <h1 class="hero__title">${msg('How to Play')}</h1>
          <p class="hero__sub">${msg('Classified Operations Manual')}</p>
          <div class="hero__line"></div>
        </div>
      </div>
    `;
  }

  /* ── TOC ─────────────────────────────────────────── */

  private _renderToc(sections: TocSection[]) {
    return html`
      <nav class="toc">
        <div class="toc__label">${msg('Contents')}</div>
        <ul class="toc__list">
          ${sections.map(
            (s) => html`
              <li>
                <a
                  class="toc__link ${this._activeSection === s.id ? 'toc__link--active' : ''}"
                  @click=${() => this._scrollToSection(s.id)}
                >${s.label}</a>
              </li>
            `,
          )}
        </ul>
      </nav>
    `;
  }

  /* ── Section 1: Epochs ───────────────────────────── */

  private _renderSectionHeader(num: string, title: string) {
    return html`
      <div class="section__divider">
        <span class="section__number">${num}</span>
        <div class="section__rule"></div>
      </div>
      <h2 class="section__title">${title}</h2>
    `;
  }

  private _renderEpochs() {
    return html`
      <section class="section" id="epochs">
        ${this._renderSectionHeader('01', msg('What is an Epoch?'))}
        <p class="section__text">
          ${msg('An Epoch is a competitive season where simulations battle across five dimensions: Stability, Influence, Sovereignty, Diplomatic, and Military. Each epoch is time-limited, divided into phases, and scored in real time. Deploy operatives, forge alliances, sabotage rivals, and climb the leaderboard. Anyone can spectate; only participants can act.')}
        </p>
      </section>
    `;
  }

  /* ── Section 2: Phases ───────────────────────────── */

  private _renderPhases() {
    const phases = getPhases();
    return html`
      <section class="section" id="phases">
        ${this._renderSectionHeader('02', msg('Phases & Timeline'))}
        <p class="section__text">
          ${msg('Every epoch progresses through 5 phases. Each phase changes what actions are available and how scores are calculated.')}
        </p>
        <div class="phases">
          ${phases.map(
            (p, i) => html`
              <div class="phase">
                <div class="phase__dot-row">
                  <div class="phase__track ${i === 0 ? 'phase__track--hidden' : ''}"></div>
                  <div class="phase__dot" style="border-color: ${p.color}; background: ${p.color}"></div>
                  <div class="phase__track ${i === phases.length - 1 ? 'phase__track--hidden' : ''}"></div>
                </div>
                <span class="phase__name" style="color: ${p.color}">${p.name}</span>
                <span class="phase__desc">${p.description}</span>
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  /* ── Section 3: Resonance Points ─────────────────── */

  private _renderRp() {
    const rules = getRpRules();
    return html`
      <section class="section" id="rp">
        ${this._renderSectionHeader('03', msg('Resonance Points (RP)'))}
        <p class="section__text">
          ${msg('RP is your action economy. Every cycle, each participant receives RP to spend on deploying operatives or running counter-intelligence sweeps. Unspent RP carries over, capped at 30.')}
        </p>
        <div class="readout">
          ${rules.map(
            (r) => html`
              <div class="readout__cell">
                <span class="readout__label">${r.label}</span>
                <span class="readout__value">${r.value}</span>
              </div>
            `,
          )}
        </div>
      </section>
    `;
  }

  /* ── Section 4: Operatives ───────────────────────── */

  private _renderOperatives() {
    const ops = getOperativeCards();
    return html`
      <section class="section" id="operatives">
        ${this._renderSectionHeader('04', msg('Operatives'))}
        <p class="section__text">
          ${msg('Six operative types, each with different costs, timings, and effects. Choose wisely — RP is scarce.')}
        </p>

        <div class="ops-grid">
          ${ops.map((op, i) => this._renderOpCard(op, i))}
        </div>

        <div class="callout callout--info">
          <div class="callout__label">${msg('Success Probability')}</div>
          <div class="callout__text">${msg('Every mission is resolved with a probability roll:')}</div>
          <div class="formula">${getSuccessFormula()}</div>
          <div class="callout__text">${msg('Clamped to [0.05, 0.95]. Guardians reduce success by 20% each. Embassy infiltration reduces effectiveness by 50%.')}</div>
        </div>
      </section>
    `;
  }

  private _renderOpCard(op: OperativeCard, index: number) {
    return html`
      <div class="op-card" style="border-left-color: ${op.color}; --i: ${index}">
        <div class="op-card__header">
          <span class="op-card__name">${op.type}</span>
          <span class="op-card__cost" style="color: ${op.color}">
            ${op.rpCost}<span class="op-card__cost-label">RP</span>
          </span>
        </div>

        <div class="op-card__stats">
          <div class="op-card__stat">
            <span class="op-card__stat-label">${msg('Deploy')}</span>
            <span class="op-card__stat-value">${op.deployCycles === 0 ? msg('Instant') : msg(str`${op.deployCycles} cycle`)}</span>
          </div>
          <div class="op-card__stat">
            <span class="op-card__stat-label">${msg('Duration')}</span>
            <span class="op-card__stat-value">${op.missionCycles === 0 ? msg('Permanent') : msg(str`${op.missionCycles} cycles`)}</span>
          </div>
          <div class="op-card__stat">
            <span class="op-card__stat-label">${msg('Score')}</span>
            <span class="op-card__stat-value">+${op.scoreValue}</span>
          </div>
        </div>

        <div class="op-card__desc">${op.description}</div>
        <div class="op-card__effect">${op.effect}</div>
      </div>
    `;
  }

  /* ── Section 5: Scoring ──────────────────────────── */

  private _renderScoring() {
    const presets = getScorePresets();
    const dims: { name: string; color: string; key: string }[] = [
      { name: msg('Stability'), color: 'var(--color-success)', key: 'stability' },
      { name: msg('Influence'), color: 'var(--color-epoch-influence)', key: 'influence' },
      { name: msg('Sovereignty'), color: 'var(--color-info)', key: 'sovereignty' },
      { name: msg('Diplomatic'), color: 'var(--color-warning)', key: 'diplomatic' },
      { name: msg('Military'), color: 'var(--color-danger)', key: 'military' },
    ];
    const balanced = presets[0]?.weights || {};

    return html`
      <section class="section" id="scoring">
        ${this._renderSectionHeader('05', msg('Scoring System'))}
        <p class="section__text">
          ${msg('Scores are computed across 5 dimensions, normalized against other participants, then weighted by the epoch preset to produce a composite score. Highest composite wins.')}
        </p>

        <div class="dim-bars">
          ${dims.map(
            (d) => html`
              <div class="dim-row">
                <span class="dim-row__label" style="color: ${d.color}">${d.name}</span>
                <div class="dim-row__bar">
                  <div class="dim-row__fill" style="background: ${d.color}; --w: ${(balanced[d.key] || 20) / 40}"></div>
                </div>
                <span class="dim-row__value">${balanced[d.key] || 20}%</span>
              </div>
            `,
          )}
        </div>

        <table class="presets-table">
          <thead>
            <tr>
              <th>${msg('Preset')}</th>
              <th>${msg('Stab')}</th>
              <th>${msg('Infl')}</th>
              <th>${msg('Sovr')}</th>
              <th>${msg('Dipl')}</th>
              <th>${msg('Milt')}</th>
            </tr>
          </thead>
          <tbody>
            ${presets.map(
              (p) => html`
                <tr>
                  <td>${p.name}</td>
                  <td>${p.weights.stability}%</td>
                  <td>${p.weights.influence}%</td>
                  <td>${p.weights.sovereignty}%</td>
                  <td>${p.weights.diplomatic}%</td>
                  <td>${p.weights.military}%</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </section>
    `;
  }

  /* ── Section 6: Alliances ────────────────────────── */

  private _renderAlliances() {
    return html`
      <section class="section" id="alliances">
        ${this._renderSectionHeader('06', msg('Alliances & Diplomacy'))}
        <p class="section__text">
          ${msg('Form teams with other simulations. Allies share no direct resources, but gain diplomatic scoring bonuses and can coordinate strikes. Embassies serve as deployment channels for operatives.')}
        </p>

        <div class="callout callout--tip">
          <div class="callout__label">${msg('Alliance Bonus')}</div>
          <div class="callout__text">
            ${msg('Each active ally gives +10% to your diplomatic score. A 3-member alliance means each member gets +20% diplomatic.')}
          </div>
        </div>

        <div class="callout callout--danger">
          <div class="callout__label">${msg('Betrayal')}</div>
          <div class="callout__text">
            ${msg('If allow_betrayal is enabled, allied simulations can attack each other. But beware: if a betrayal mission is detected, the entire alliance dissolves and the betrayer receives a \u221220% diplomatic score penalty. With the Diplomat preset (35% diplomatic weight), this is catastrophic.')}
          </div>
        </div>
      </section>
    `;
  }

  /* ── Section 7: Bleed ────────────────────────────── */

  private _renderBleed() {
    return html`
      <section class="section" id="bleed">
        ${this._renderSectionHeader('07', msg('Bleed & Echoes'))}
        <p class="section__text">
          ${msg('The Bleed is the cross-simulation influence that connects the multiverse. Events in one simulation can echo into others, creating ripple effects. During Reckoning phase, bleed is amplified \u2014 sovereignty scores fluctuate more, and echo opportunities multiply.')}
        </p>

        <div class="callout callout--warn">
          <div class="callout__label">${msg('Sovereignty')}</div>
          <div class="callout__text">
            ${msg('Sovereignty measures how well you resist foreign influence. Events with data_source "bleed" or "propagandist" count against your sovereignty score. Strong sovereignty = resilient simulation.')}
          </div>
        </div>
      </section>
    `;
  }

  /* ── Section 8: Tactics ──────────────────────────── */

  private _renderTactics() {
    const tactics = getTactics();
    return html`
      <section class="section" id="tactics">
        ${this._renderSectionHeader('08', msg('Tactics & Strategies'))}
        <p class="section__text">
          ${msg('Proven strategies for each phase, economy management, counter-play patterns, and preset-specific approaches. Study these before your first deployment.')}
        </p>

        <div class="tactics-grid">
          ${tactics.map((t, i) => this._renderTacticCard(t, i))}
        </div>
      </section>
    `;
  }

  private _renderTacticCard(tactic: TacticCard, index: number) {
    return html`
      <div class="tactic-card tactic-card--${tactic.category}" style="--i: ${index}">
        <div class="tactic-card__header">
          <span class="tactic-card__title">${tactic.title}</span>
          <span class="tactic-card__badge tactic-card__badge--${tactic.category}">${tactic.category}</span>
        </div>
        <div class="tactic-card__desc">${tactic.description}</div>
      </div>
    `;
  }

  /* ── Section 9: Matches ──────────────────────────── */

  private _renderMatches() {
    const matches = getMatches();
    return html`
      <section class="section" id="matches">
        ${this._renderSectionHeader('09', msg('Example Matches'))}
        <p class="section__text">
          ${msg('Five fully worked-out matches showing different strategies, presets, and mechanics in action. Expand each match to see cycle-by-cycle replays.')}
        </p>

        ${matches.map((m, i) => this._renderMatch(m, i))}
      </section>
    `;
  }

  private _renderMatch(match: MatchConfig, index: number) {
    const expanded = this._expandedMatches.has(index);

    return html`
      <div class="match">
        <div class="match__header"
          role="button"
          tabindex="0"
          aria-expanded=${expanded}
          @click=${() => this._toggleMatch(index)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this._toggleMatch(index);
            }
          }}
        >
          <div class="match__title-group">
            <h3 class="match__title">${match.title}</h3>
            <span class="match__subtitle">${match.subtitle}</span>
          </div>
          <div class="match__meta">
            <span class="match__meta-tag">${match.duration}</span>
            <span class="match__meta-tag">${match.preset}</span>
            <span class="match__meta-tag">${msg(str`${match.players.length}P`)}</span>
          </div>
          <span class="match__toggle ${expanded ? 'match__toggle--open' : ''}">▼</span>
        </div>

        ${expanded ? this._renderMatchBody(match) : nothing}
      </div>
    `;
  }

  private _renderMatchBody(match: MatchConfig) {
    return html`
      <div class="match__body">
        <div class="match__desc">${match.description}</div>

        ${
          match.specialRules
            ? html`<div class="callout callout--warn">
              <div class="callout__label">${msg('Special Rules')}</div>
              <div class="callout__text">${match.specialRules}</div>
            </div>`
            : nothing
        }

        <div class="match__players">
          ${match.players.map((p) => html`<span class="match__player">${p}</span>`)}
        </div>

        ${this._renderCycleTable(match.cycleData)}
        ${this._renderStandings(match.finalStandings)}
        ${this._renderKeyMoments(match.keyMoments)}
      </div>
    `;
  }

  private _renderCycleTable(cycles: CycleData[]) {
    return html`
      <div>
        <div class="cycles-label">${msg('Cycle-by-Cycle Replay')}</div>
        <div class="cycles-wrap">
          <table class="cycles-table">
            <thead>
              <tr>
                <th>${msg('Cycle')}</th>
                <th>${msg('Phase')}</th>
                <th>${msg('Simulation')}</th>
                <th>${msg('Action')}</th>
                <th>RP</th>
                <th>${msg('Notes')}</th>
              </tr>
            </thead>
            <tbody>
              ${cycles.flatMap((c) => this._renderCycleRows(c))}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _renderCycleRows(cycle: CycleData): TemplateResult[] {
    if (cycle.actions.length === 0) {
      return [
        html`
        <tr>
          <td>${cycle.cycle}</td>
          <td><span class="cycle-phase cycle-phase--${cycle.phase}">${cycle.phase}</span></td>
          <td colspan="4" style="color: var(--color-gray-500); font-style: italic;">
            ${
              cycle.scoreSnapshot
                ? html`${msg('Final scores')}: ${Object.entries(cycle.scoreSnapshot)
                    .map(([name, score]) => html`<strong>${name}</strong>: ${score} `)
                    .join('')}`
                : msg('No actions')
            }
          </td>
        </tr>
      `,
      ];
    }

    return cycle.actions.map(
      (a, i) => html`
        <tr>
          <td>${i === 0 ? cycle.cycle : ''}</td>
          <td>${i === 0 ? html`<span class="cycle-phase cycle-phase--${cycle.phase}">${cycle.phase}</span>` : ''}</td>
          <td>${a.simulation}</td>
          <td>
            <span class="${a.outcome ? `outcome--${a.outcome}` : ''}">${a.action}</span>
            ${a.target ? html` \u2192 <em>${a.target}</em>` : nothing}
          </td>
          <td>${a.rpCost > 0 ? `-${a.rpCost}` : ''}</td>
          <td>${a.note ? html`<span class="cycle-note">${a.note}</span>` : ''}</td>
        </tr>
      `,
    );
  }

  private _renderStandings(standings: FinalStanding[]) {
    return html`
      <div>
        <div class="standings-label">${msg('Final Standings')}</div>
        <div class="cycles-wrap">
          <table class="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>${msg('Simulation')}</th>
                <th>${msg('Composite')}</th>
                <th>${msg('Stab')}</th>
                <th>${msg('Infl')}</th>
                <th>${msg('Sovr')}</th>
                <th>${msg('Dipl')}</th>
                <th>${msg('Milt')}</th>
              </tr>
            </thead>
            <tbody>
              ${standings.map(
                (s) => html`
                  <tr>
                    <td><span class="standings-rank standings-rank--${s.rank}">${s.rank}</span></td>
                    <td>
                      ${s.simulation}
                      ${s.title ? html`<br><span class="standings-title">"${s.title}"</span>` : nothing}
                    </td>
                    <td class="standings-composite">${s.composite}</td>
                    <td>${s.stability}</td>
                    <td>${s.influence}</td>
                    <td>${s.sovereignty}</td>
                    <td>${s.diplomatic}</td>
                    <td>${s.military}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _renderKeyMoments(moments: string[]) {
    return html`
      <div>
        <div class="moments-label">${msg('Key Moments')}</div>
        <ul class="moments-list">
          ${moments.map((m) => html`<li>${m}</li>`)}
        </ul>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play': VelgHowToPlay;
  }
}
