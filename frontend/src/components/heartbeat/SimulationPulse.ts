/**
 * Simulation Pulse — Substrate Monitoring Station.
 *
 * The most important player-facing component: a battle-log-style
 * ticker showing the simulation's evolution tick-by-tick.
 *
 * Aesthetic: "Classified Medical Monitoring Station" — phosphor-green
 * vital signs on dark surface, EKG sweep, scanline overlays,
 * classified stamps, heartbeat blips.
 *
 * Modeled on EpochBattleLog: staggered slide-in entries, type-specific
 * accent colors, severity indicators. Grouped by tick number with
 * collapsible tick headers styled as medical chart dividers.
 *
 * Accessibility: ARIA roles, keyboard-navigable filter chips,
 * prefers-reduced-motion respected. WCAG AA contrast on all text.
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import './AgentLifeTimeline.js';
import type { HeartbeatEntry, HeartbeatEntryType, HeartbeatOverview } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { renderInfoBubble, infoBubbleStyles } from '../shared/info-bubble-styles.js';

type FilterKey = 'all' | 'zone' | 'events' | 'resonance' | 'bureau' | 'diplomatic' | 'arcs';

const FILTER_TYPES: Record<FilterKey, HeartbeatEntryType[] | null> = {
  all: null,
  zone: ['zone_shift'],
  events: ['event_aging', 'event_escalation', 'event_resolution'],
  resonance: ['resonance_pressure', 'scar_tissue'],
  bureau: ['bureau_response', 'attunement_deepen', 'positive_event'],
  diplomatic: ['anchor_strengthen'],
  arcs: ['cascade_spawn', 'convergence', 'narrative_arc', 'system_note'],
};

@localized()
@customElement('velg-simulation-pulse')
export class VelgSimulationPulse extends SignalWatcher(LitElement) {
  static styles = [infoBubbleStyles, css`
    /* ═══════════════════════════════════════
       SUBSTRATE MONITORING STATION
       Classified Medical Monitoring Aesthetic
       ═══════════════════════════════════════ */

    :host {
      display: block;
      color: var(--color-text-primary);
      --_phosphor: var(--color-success);
      --_phosphor-dim: color-mix(in srgb, var(--color-success) 40%, transparent);
      --_phosphor-glow: color-mix(in srgb, var(--color-success) 12%, transparent);
      --_surface-dark: var(--color-surface);
      --_danger-glow: color-mix(in srgb, var(--color-danger) 15%, transparent);
      --_emerald: var(--color-success);
      --_emerald-glow: color-mix(in srgb, var(--color-success) 12%, transparent);
      --_scar: color-mix(in srgb, var(--color-danger) 55%, var(--color-info));
      --_scar-glow: color-mix(in srgb, var(--_scar) 20%, transparent);
      --_cascade: var(--color-primary);
      --_cascade-magenta: #d946ef; /* lint-color-ok */
      --_cascade-glow: color-mix(in srgb, var(--_cascade-magenta) 15%, transparent);
      --_positive-text: color-mix(in srgb, var(--color-success) 65%, var(--color-text-primary));
    }

    /* ══════════════════════════════════════════
       HEADER — Medical Monitor Top Bar
       ══════════════════════════════════════════ */

    .pulse-header {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-6) var(--space-4) var(--space-5);
      border-bottom: 2px solid color-mix(in srgb, var(--_phosphor) 20%, var(--color-border));
      overflow: hidden;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--_phosphor) 3%, var(--_surface-dark)) 0%,
        var(--_surface-dark) 100%
      );
    }

    /* Dense scanline texture overlay */
    .pulse-header::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          color-mix(in srgb, var(--color-text-primary) 1.8%, transparent) 2px,
          color-mix(in srgb, var(--color-text-primary) 1.8%, transparent) 4px
        ),
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 6px,
          color-mix(in srgb, var(--_phosphor) 0.8%, transparent) 6px,
          color-mix(in srgb, var(--_phosphor) 0.8%, transparent) 8px
        );
      pointer-events: none;
      z-index: 0;
    }

    /* EKG heartbeat sweep line — enhanced with sharper peaks */
    .pulse-header::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--_phosphor-dim) 8%,
        var(--_phosphor) 12%,
        transparent 16%,
        transparent 32%,
        var(--_phosphor-dim) 35%,
        var(--_phosphor) 37%,
        var(--color-warning) 39%,
        var(--_phosphor) 41%,
        var(--_phosphor-dim) 43%,
        transparent 48%,
        transparent 60%,
        var(--_phosphor-dim) 63%,
        var(--_phosphor) 65%,
        var(--color-danger) 67%,
        var(--_phosphor) 69%,
        var(--_phosphor-dim) 71%,
        transparent 76%,
        transparent 88%,
        var(--_phosphor-dim) 92%,
        var(--_phosphor) 94%,
        transparent 98%
      );
      background-size: 300% 100%;
      animation: ekg-sweep 3.5s linear infinite;
      filter: drop-shadow(0 0 4px var(--_phosphor));
    }

    @keyframes ekg-sweep {
      0% { background-position: 300% 0; }
      100% { background-position: -300% 0; }
    }

    .pulse-header > * {
      position: relative;
      z-index: 1;
    }

    .pulse-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: clamp(1.25rem, 3vw, var(--text-2xl));
      text-transform: uppercase;
      letter-spacing: 0.18em;
      margin: 0;
      color: var(--color-text-primary);
      text-shadow:
        0 0 30px color-mix(in srgb, var(--_phosphor) 12%, transparent),
        0 0 60px color-mix(in srgb, var(--_phosphor) 4%, transparent);
    }

    .pulse-header__tick {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--_phosphor);
      background: color-mix(in srgb, var(--_phosphor) 8%, var(--color-surface-raised));
      border: 1px solid color-mix(in srgb, var(--_phosphor) 30%, transparent);
      padding: var(--space-1) var(--space-3);
      animation: tick-glow 3s ease-in-out infinite;
      text-shadow: 0 0 8px var(--_phosphor-glow);
    }

    @keyframes tick-glow {
      0%, 100% { box-shadow: none; }
      50% { box-shadow: 0 0 16px var(--_phosphor-glow), inset 0 0 8px var(--_phosphor-glow); }
    }

    .pulse-header__countdown {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-left: auto;
    }

    /* Heartbeat blip — rapid double-pulse mimicking a real heartbeat */
    .pulse-header__status {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
      animation: heartbeat-blip 3s ease-in-out infinite;
    }

    .pulse-header__status--healthy {
      background: var(--_phosphor);
      box-shadow: 0 0 8px var(--_phosphor), 0 0 20px var(--_phosphor-glow);
    }
    .pulse-header__status--pressure {
      background: var(--color-warning);
      box-shadow: 0 0 8px var(--color-warning), 0 0 20px color-mix(in srgb, var(--color-warning) 15%, transparent);
    }
    .pulse-header__status--crisis {
      background: var(--color-danger);
      box-shadow: 0 0 10px var(--color-danger), 0 0 24px var(--_danger-glow);
    }

    /* Real heartbeat: two quick pulses then rest */
    @keyframes heartbeat-blip {
      0%   { transform: scale(1);   opacity: 0.7; }
      6%   { transform: scale(1.5); opacity: 1;   }
      10%  { transform: scale(1);   opacity: 0.8; }
      14%  { transform: scale(1.35); opacity: 1;  }
      20%  { transform: scale(1);   opacity: 0.7; }
      100% { transform: scale(1);   opacity: 0.7; }
    }

    /* ══════════════════════════════════════════
       FILTER BAR — Classified Tabs
       ══════════════════════════════════════════ */

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-2) var(--space-4);
      background: color-mix(in srgb, var(--_phosphor) 2%, transparent);
      border-bottom: 1px solid var(--color-border);
    }

    .filter-chip {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: var(--space-2) var(--space-3);
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all var(--transition-fast);
      min-height: 44px;
      position: relative;
    }

    .filter-chip::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      width: 0;
      height: 2px;
      background: var(--color-primary);
      transition: width 0.2s ease, left 0.2s ease;
      box-shadow: 0 0 6px color-mix(in srgb, var(--color-primary) 40%, transparent);
    }

    .filter-chip:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-secondary);
      background: color-mix(in srgb, var(--color-text-primary) 3%, transparent);
    }

    .filter-chip:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .filter-chip--active {
      color: var(--color-primary);
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      box-shadow: 0 0 12px color-mix(in srgb, var(--color-primary) 10%, transparent);
    }

    /* Stamped underline on active tab */
    .filter-chip--active::after {
      width: 80%;
      left: 10%;
    }

    /* ══════════════════════════════════════════
       FEED — The Chronicle Stream
       ══════════════════════════════════════════ */

    .feed {
      display: flex;
      flex-direction: column;
      gap: 0;
      position: relative;
      background:
        /* Subtle noise/grain texture */
        url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E"),
        linear-gradient(
          180deg,
          transparent 0%,
          color-mix(in srgb, var(--_phosphor) 1%, transparent) 50%,
          transparent 100%
        );
    }

    /* ══════════════════════════════════════════
       TICK GROUP — Medical Chart Dividers
       ══════════════════════════════════════════ */

    .tick-group {
      margin-bottom: 0;
      border-bottom: 1px solid color-mix(in srgb, var(--_phosphor) 8%, var(--color-border));
    }

    .tick-group:last-child {
      border-bottom: none;
    }

    .tick-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3);
      cursor: pointer;
      transition: background var(--transition-fast);
      border: none;
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--_phosphor) 4%, transparent) 0%,
        transparent 60%
      );
      width: 100%;
      text-align: left;
      color: inherit;
      opacity: 0;
      animation: entry-slide 0.3s ease-out forwards;
      position: relative;
      min-height: 44px;
    }

    /* Heartbeat blip bar on left of tick header */
    .tick-header::before {
      content: '';
      position: absolute;
      left: 0;
      top: 15%;
      width: 3px;
      height: 70%;
      background: var(--_phosphor);
      opacity: 0.3;
      transition: opacity 0.2s ease, box-shadow 0.2s ease;
    }

    .tick-header:hover::before {
      opacity: 0.8;
      box-shadow: 0 0 8px var(--_phosphor-glow);
    }

    .tick-header:hover {
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--_phosphor) 8%, transparent) 0%,
        color-mix(in srgb, var(--_phosphor) 2%, transparent) 60%,
        transparent 100%
      );
    }

    .tick-header:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }

    .tick-header__blip {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--_phosphor);
      box-shadow: 0 0 6px var(--_phosphor);
      animation: tick-blip 2.5s ease-in-out infinite;
      flex-shrink: 0;
    }

    @keyframes tick-blip {
      0%, 100% { opacity: 0.4; transform: scale(0.8); }
      15% { opacity: 1; transform: scale(1.3); }
      25% { opacity: 0.5; transform: scale(0.9); }
      35% { opacity: 0.9; transform: scale(1.15); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }

    .tick-header__number {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--_phosphor);
      text-shadow: 0 0 20px color-mix(in srgb, var(--_phosphor) 18%, transparent);
    }

    .tick-header__line {
      flex: 1;
      height: 1px;
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--_phosphor) 25%, var(--color-border)) 0%,
        var(--color-border) 40%,
        transparent 100%
      );
    }

    .tick-header__count {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
    }

    /* ── Tick Summary ── */

    .tick-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-4);
      margin-bottom: var(--space-2);
      border-left: 2px solid var(--color-border);
      background: color-mix(in srgb, var(--color-surface-sunken) 40%, transparent);
      font-family: var(--font-body);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .tick-summary--critical {
      border-left-color: var(--color-danger);
    }

    .tick-summary--positive {
      border-left-color: var(--color-success);
    }

    .tick-summary__text {
      flex: 1;
    }

    .tick-summary__alert {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-black);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-danger);
      flex-shrink: 0;
    }

    .tick-header__chevron {
      color: var(--_phosphor-dim);
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .tick-header__chevron--open {
      transform: rotate(90deg);
    }

    /* ══════════════════════════════════════════
       ENTRY — Individual Log Line
       ══════════════════════════════════════════ */

    .entry {
      display: grid;
      grid-template-columns: 36px 1fr auto;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3);
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
      opacity: 0;
      transform: translateY(4px);
      animation: entry-slide 0.25s ease-out forwards;
      transition: background var(--transition-normal);
      position: relative;
    }

    /* Type accent left border */
    .entry::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      opacity: 0;
      transition: opacity var(--transition-normal);
    }

    .entry:hover { background: color-mix(in srgb, var(--color-text-primary) 2%, transparent); }
    .entry:hover::before { opacity: 1; }
    .entry:last-child { border-bottom: none; }

    @keyframes entry-slide {
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Type accent colors ──────────────── */

    .entry--zone_shift::before           { background: var(--color-warning); }
    .entry--event_aging::before          { background: var(--color-text-muted); }
    .entry--event_escalation::before     { background: var(--color-danger); }
    .entry--event_resolution::before     { background: var(--_emerald); }
    .entry--scar_tissue::before          { background: var(--_scar); }
    .entry--resonance_pressure::before   { background: var(--color-info); }
    .entry--bureau_response::before      { background: var(--color-text-primary); }
    .entry--attunement_deepen::before    { background: var(--color-warning); }
    .entry--anchor_strengthen::before    { background: var(--color-info); }
    .entry--narrative_arc::before        { background: var(--color-warning); }
    .entry--system_note::before          { background: var(--color-border); }

    /* Cascade/convergence/positive — always visible left bar */
    .entry--cascade_spawn::before        { background: var(--color-danger); width: 4px; opacity: 1; }
    .entry--convergence::before          { background: var(--_cascade-magenta); width: 4px; opacity: 1; }
    .entry--positive_event::before       { background: var(--_emerald); width: 3px; opacity: 1; }

    /* ── Icon with accent glow ─────────── */

    .entry__icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-icon);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      flex-shrink: 0;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    }

    .entry:hover .entry__icon {
      transform: scale(1.08);
    }

    /* Type-specific icon glow on hover */
    .entry--zone_shift:hover .entry__icon           { box-shadow: 0 0 10px color-mix(in srgb, var(--color-warning) 25%, transparent); }
    .entry--event_escalation:hover .entry__icon      { box-shadow: 0 0 10px var(--_danger-glow); }
    .entry--event_resolution:hover .entry__icon      { box-shadow: 0 0 10px var(--_emerald-glow); }
    .entry--scar_tissue:hover .entry__icon           { box-shadow: 0 0 10px var(--_scar-glow); }
    .entry--resonance_pressure:hover .entry__icon    { box-shadow: 0 0 10px color-mix(in srgb, var(--color-info) 20%, transparent); }
    .entry--cascade_spawn:hover .entry__icon         { box-shadow: 0 0 12px var(--_danger-glow); }
    .entry--convergence:hover .entry__icon           { box-shadow: 0 0 12px var(--_cascade-glow); }
    .entry--positive_event:hover .entry__icon        { box-shadow: 0 0 10px var(--_emerald-glow); }
    .entry--bureau_response:hover .entry__icon       { box-shadow: 0 0 10px color-mix(in srgb, var(--color-text-primary) 10%, transparent); }
    .entry--attunement_deepen:hover .entry__icon     { box-shadow: 0 0 10px color-mix(in srgb, var(--color-warning) 20%, transparent); }
    .entry--anchor_strengthen:hover .entry__icon     { box-shadow: 0 0 10px color-mix(in srgb, var(--color-info) 25%, transparent); }
    .entry--narrative_arc:hover .entry__icon          { box-shadow: 0 0 10px color-mix(in srgb, var(--color-warning) 25%, transparent); }

    /* ── Content ─────────────────────────── */

    .entry__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .entry__narrative {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .entry__type {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-tertiary);
    }

    .entry__meta {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-tertiary);
      white-space: nowrap;
      align-self: start;
      padding-top: 2px;
    }

    /* ══════════════════════════════════════════
       SEVERITY — Critical / Warning / Positive
       ══════════════════════════════════════════ */

    /* CRITICAL: red border glow + pulsing background */
    .entry--severity-critical {
      background: color-mix(in srgb, var(--color-danger) 5%, transparent);
      border-left: 3px solid var(--color-danger);
      box-shadow: inset 4px 0 12px -4px var(--_danger-glow);
      animation: entry-slide 0.25s ease-out forwards, critical-pulse 2.5s ease-in-out infinite;
    }
    .entry--severity-critical::before { opacity: 1 !important; }
    .entry--severity-critical .entry__narrative {
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
    }
    .entry--severity-critical .entry__icon {
      border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
      box-shadow: 0 0 8px var(--_danger-glow);
    }

    @keyframes critical-pulse {
      0%, 100% { box-shadow: inset 4px 0 12px -4px var(--_danger-glow); }
      50% {
        box-shadow:
          inset 4px 0 20px -4px color-mix(in srgb, var(--color-danger) 25%, transparent),
          inset 0 0 30px -15px color-mix(in srgb, var(--color-danger) 8%, transparent);
      }
    }

    /* POSITIVE: emerald shimmer */
    .entry--severity-positive {
      background: color-mix(in srgb, var(--_emerald) 4%, transparent);
      border-left: 2px solid var(--_emerald);
      box-shadow: inset 3px 0 10px -4px var(--_emerald-glow);
      animation: entry-slide 0.25s ease-out forwards, emerald-shimmer 4s ease-in-out infinite;
    }
    .entry--severity-positive .entry__narrative {
      color: var(--_positive-text);
    }
    .entry--severity-positive .entry__icon {
      border-color: color-mix(in srgb, var(--_emerald) 30%, var(--color-border));
    }

    @keyframes emerald-shimmer {
      0%, 100% {
        background: color-mix(in srgb, var(--color-success) 4%, transparent);
        box-shadow: inset 3px 0 10px -4px var(--_emerald-glow);
      }
      50% {
        background: color-mix(in srgb, var(--color-success) 7%, transparent);
        box-shadow:
          inset 3px 0 16px -4px color-mix(in srgb, var(--color-success) 20%, transparent),
          inset 0 0 20px -10px color-mix(in srgb, var(--color-success) 6%, transparent);
      }
    }

    /* CASCADE + CONVERGENCE — dramatic gradient backgrounds */
    .entry--cascade_spawn {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-danger) 6%, transparent) 0%,
        color-mix(in srgb, var(--color-warning) 4%, transparent) 50%,
        color-mix(in srgb, var(--color-danger) 3%, transparent) 100%
      );
      border-left: 4px solid var(--color-danger);
      box-shadow:
        inset 6px 0 20px -6px var(--_danger-glow),
        0 0 1px color-mix(in srgb, var(--color-danger) 30%, transparent);
      animation: entry-slide 0.25s ease-out forwards, cascade-drama 3s ease-in-out infinite;
    }
    .entry--cascade_spawn .entry__narrative {
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
    }
    .entry--cascade_spawn .entry__icon {
      border-color: color-mix(in srgb, var(--color-danger) 50%, var(--color-border));
      box-shadow: 0 0 10px var(--_danger-glow);
    }

    @keyframes cascade-drama {
      0%, 100% {
        box-shadow: inset 6px 0 20px -6px var(--_danger-glow), 0 0 1px color-mix(in srgb, var(--color-danger) 30%, transparent);
      }
      50% {
        box-shadow:
          inset 6px 0 30px -6px color-mix(in srgb, var(--color-danger) 30%, transparent),
          0 0 2px color-mix(in srgb, var(--color-danger) 40%, transparent),
          inset 0 0 40px -20px color-mix(in srgb, var(--color-danger) 8%, transparent);
      }
    }

    .entry--convergence {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--_cascade-magenta) 6%, transparent) 0%,
        color-mix(in srgb, var(--_cascade-magenta) 4%, transparent) 50%,
        color-mix(in srgb, var(--_cascade-magenta) 3%, transparent) 100%
      );
      border-left: 4px solid var(--_cascade-magenta);
      box-shadow:
        inset 6px 0 20px -6px var(--_cascade-glow),
        0 0 1px color-mix(in srgb, var(--_cascade-magenta) 30%, transparent);
      animation: entry-slide 0.25s ease-out forwards, convergence-drama 3.5s ease-in-out infinite;
    }
    .entry--convergence .entry__narrative {
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
    }
    .entry--convergence .entry__icon {
      border-color: color-mix(in srgb, var(--_cascade-magenta) 40%, var(--color-border));
      box-shadow: 0 0 10px var(--_cascade-glow);
    }

    @keyframes convergence-drama {
      0%, 100% {
        box-shadow: inset 6px 0 20px -6px var(--_cascade-glow), 0 0 1px color-mix(in srgb, var(--_cascade-magenta) 30%, transparent);
      }
      50% {
        box-shadow:
          inset 6px 0 30px -6px color-mix(in srgb, var(--_cascade-magenta) 25%, transparent),
          0 0 2px color-mix(in srgb, var(--_cascade-magenta) 40%, transparent),
          inset 0 0 40px -20px color-mix(in srgb, var(--_cascade-magenta) 8%, transparent);
      }
    }

    /* ══════════════════════════════════════════
       SEVERITY BADGES — Classified Stamps
       ══════════════════════════════════════════ */

    .severity-badge {
      display: inline-block;
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 2px 8px;
      margin-left: var(--space-2);
      vertical-align: middle;
      border-width: 2px;
      border-style: solid;
    }

    .severity-badge--critical {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-danger) 15%, transparent);
      text-shadow: 0 0 6px color-mix(in srgb, var(--color-danger) 30%, transparent);
    }

    .severity-badge--warning {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
      background: color-mix(in srgb, var(--color-warning) 10%, transparent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-warning) 12%, transparent);
      text-shadow: 0 0 6px color-mix(in srgb, var(--color-warning) 25%, transparent);
    }

    .severity-badge--positive {
      color: var(--_emerald);
      border-color: color-mix(in srgb, var(--color-success) 50%, transparent);
      background: color-mix(in srgb, var(--color-success) 10%, transparent);
      box-shadow: 0 0 8px var(--_emerald-glow);
      text-shadow: 0 0 6px color-mix(in srgb, var(--color-success) 30%, transparent);
    }

    /* ══════════════════════════════════════════
       EMPTY / LOADING / LOAD MORE
       ══════════════════════════════════════════ */

    .empty, .loading {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-8) var(--space-4);
    }

    .loading {
      animation: loading-pulse 1.5s ease-in-out infinite;
    }

    @keyframes loading-pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }

    .load-more {
      display: flex;
      justify-content: center;
      padding: var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    .load-more__btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-6);
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
      min-height: 44px;
    }

    .load-more__btn:hover {
      color: var(--_phosphor);
      border-color: var(--_phosphor);
      background: color-mix(in srgb, var(--_phosphor) 5%, transparent);
      box-shadow: 0 0 12px var(--_phosphor-glow);
    }

    .load-more__btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* ══════════════════════════════════════════
       REDUCED MOTION
       ══════════════════════════════════════════ */

    @media (prefers-reduced-motion: reduce) {
      .entry,
      .tick-header,
      .pulse-header__status,
      .pulse-header__tick,
      .tick-header__blip,
      .loading,
      .entry--severity-critical,
      .entry--severity-positive,
      .entry--cascade_spawn,
      .entry--convergence {
        animation: none !important;
        opacity: 1;
        transform: none;
      }
      .pulse-header::after {
        animation: none !important;
      }
    }
  `];

  @property({ type: String }) simulationId = '';
  @state() private _entries: HeartbeatEntry[] = [];
  @state() private _overview: HeartbeatOverview | null = null;
  @state() private _loading = true;
  @state() private _filter: FilterKey = 'all';
  @state() private _collapsedTicks = new Set<number>();
  @state() private _total = 0;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId) {
      this._loadData();
    }
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('simulationId') && this.simulationId) {
      this._loadData();
    }
  }

  private async _loadData(): Promise<void> {
    this._loading = true;
    const params: Record<string, string> = { limit: '100' };
    const filterTypes = FILTER_TYPES[this._filter];
    if (filterTypes && filterTypes.length === 1) {
      params.entry_type = filterTypes[0];
    }

    const [overviewRes, entriesRes] = await Promise.all([
      heartbeatApi.getOverview(this.simulationId),
      heartbeatApi.listEntries(this.simulationId, params),
    ]);

    if (overviewRes.success && overviewRes.data) {
      this._overview = overviewRes.data as HeartbeatOverview;
    }
    if (entriesRes.success && entriesRes.data) {
      this._entries = entriesRes.data as HeartbeatEntry[];
      this._total = entriesRes.meta?.total ?? this._entries.length;
    }
    this._loading = false;
  }

  private _setFilter(filter: FilterKey): void {
    this._filter = filter;
    this._loadData();
  }

  private _toggleTick(tickNumber: number): void {
    const next = new Set(this._collapsedTicks);
    if (next.has(tickNumber)) {
      next.delete(tickNumber);
    } else {
      next.add(tickNumber);
    }
    this._collapsedTicks = next;
  }

  private get _filteredEntries(): HeartbeatEntry[] {
    const types = FILTER_TYPES[this._filter];
    if (!types) return this._entries;
    return this._entries.filter((e) => types.includes(e.entry_type));
  }

  private get _groupedByTick(): Map<number, HeartbeatEntry[]> {
    const groups = new Map<number, HeartbeatEntry[]>();
    for (const entry of this._filteredEntries) {
      const group = groups.get(entry.tick_number) ?? [];
      group.push(entry);
      groups.set(entry.tick_number, group);
    }
    return groups;
  }

  private _getStatusClass(): string {
    if (!this._overview) return 'healthy';
    if (this._overview.active_arcs > 2) return 'crisis';
    if (this._overview.active_arcs > 0 || this._overview.pending_responses > 0) return 'pressure';
    return 'healthy';
  }

  private _formatCountdown(): string {
    if (!this._overview?.next_heartbeat_at) return '';
    const next = new Date(this._overview.next_heartbeat_at);
    const now = new Date();
    const diff = next.getTime() - now.getTime();
    if (diff <= 0) return msg('Imminent');
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  private _getEntryIcon(type: HeartbeatEntryType): TemplateResult {
    const iconMap: Record<HeartbeatEntryType, () => TemplateResult> = {
      zone_shift: () => icons.layerInfrastructure(16),
      event_aging: () => icons.timer(16),
      event_escalation: () => icons.alertTriangle(16),
      event_resolution: () => icons.checkCircle(16),
      scar_tissue: () => icons.fracture(16),
      resonance_pressure: () => icons.radar(16),
      cascade_spawn: () => icons.bolt(16),
      bureau_response: () => icons.stampClassified(16),
      attunement_deepen: () => icons.compassRose(16),
      anchor_strengthen: () => icons.anchor(16),
      convergence: () => icons.handshake(16),
      positive_event: () => icons.bolt(16),
      narrative_arc: () => icons.book(16),
      system_note: () => icons.magnifyingGlass(16),
    };
    return (iconMap[type] ?? (() => icons.bolt(16)))();
  }

  private _getTypeLabel(type: HeartbeatEntryType): string {
    switch (type) {
      case 'zone_shift': return msg('Zone Shift');
      case 'event_aging': return msg('Event Aging');
      case 'event_escalation': return msg('Escalation');
      case 'event_resolution': return msg('Resolution');
      case 'scar_tissue': return msg('Scar Tissue');
      case 'resonance_pressure': return msg('Resonance');
      case 'cascade_spawn': return msg('Cascade');
      case 'bureau_response': return msg('Bureau');
      case 'attunement_deepen': return msg('Attunement');
      case 'anchor_strengthen': return msg('Anchor');
      case 'convergence': return msg('Convergence');
      case 'positive_event': return msg('Harvest');
      case 'narrative_arc': return msg('Arc');
      case 'system_note': return msg('System');
      default: return type;
    }
  }

  private _formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return msg('Just now');
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  }

  protected render() {
    return html`
      ${this._renderHeader()}
      ${this._renderFilters()}
      ${this._loading
        ? html`<div class="loading" role="status" aria-live="polite">${msg('Loading chronicle...')}</div>`
        : this._renderFeed()}

      <!-- Agent Autonomy Activity Log -->
      <velg-agent-life-timeline
        .simulationId=${this.simulationId}
      ></velg-agent-life-timeline>
    `;
  }

  private _renderHeader() {
    const o = this._overview;
    const statusClass = this._getStatusClass();
    const countdown = this._formatCountdown();

    return html`
      <div class="pulse-header">
        <span
          class="pulse-header__status pulse-header__status--${statusClass}"
          role="status"
          aria-label=${msg('Heartbeat status') + ': ' + statusClass}
        ></span>
        <h2 class="pulse-header__title">
          ${msg('Substrate Pulse')}
          ${renderInfoBubble(msg('The Substrate Pulse monitors all heartbeat activity. Every tick, the simulation processes events, narrative arcs, and zone dynamics. Filter by category to focus on specific systems.'))}
        </h2>
        ${o ? html`
          <span class="pulse-header__tick" aria-label=${msg('Current tick')}>
            ${msg('Tick')} #${o.last_tick}
          </span>
        ` : nothing}
        ${countdown ? html`
          <span class="pulse-header__countdown" aria-label=${msg('Next heartbeat countdown')}>
            ${msg('Next heartbeat in')} ${countdown}
          </span>
        ` : nothing}
      </div>
    `;
  }

  private _renderFilters() {
    const filterLabels: Record<FilterKey, string> = {
      all: msg('All'),
      zone: msg('Zone'),
      events: msg('Events'),
      resonance: msg('Resonance'),
      bureau: msg('Bureau'),
      diplomatic: msg('Diplomatic'),
      arcs: msg('Arcs'),
    };

    return html`
      <div class="filters" role="tablist" aria-label=${msg('Chronicle filters')}>
        ${(Object.keys(filterLabels) as FilterKey[]).map(
          (key) => html`
            <button
              class="filter-chip ${this._filter === key ? 'filter-chip--active' : ''}"
              role="tab"
              aria-selected=${this._filter === key}
              @click=${() => this._setFilter(key)}
            >${filterLabels[key]}</button>
          `,
        )}
      </div>
    `;
  }

  private _renderFeed() {
    const groups = this._groupedByTick;
    if (groups.size === 0) {
      return html`
        <div class="empty" role="status">
          ${msg('No chronicle entries yet. The substrate awaits its first heartbeat.')}
        </div>
      `;
    }

    // Sort tick numbers descending (newest first)
    const tickNumbers = [...groups.keys()].sort((a, b) => b - a);
    let entryIndex = 0;

    return html`
      <div class="feed" role="log" aria-label=${msg('Substrate chronicle feed')} aria-live="polite">
        ${tickNumbers.map((tickNum) => {
          const entries = groups.get(tickNum) ?? [];
          const collapsed = this._collapsedTicks.has(tickNum);

          return html`
            <div class="tick-group">
              <button
                class="tick-header"
                style="animation-delay: ${entryIndex * 0.03}s"
                aria-expanded=${!collapsed}
                aria-controls="tick-${tickNum}"
                @click=${() => this._toggleTick(tickNum)}
              >
                <span class="tick-header__blip" aria-hidden="true"></span>
                <span class="tick-header__chevron ${collapsed ? '' : 'tick-header__chevron--open'}">
                  ${icons.chevronRight(12)}
                </span>
                <span class="tick-header__number">${msg('Tick')} #${tickNum}</span>
                <span class="tick-header__line"></span>
                <span class="tick-header__count">${entries.length} ${entries.length === 1 ? msg('entry') : msg('entries')}</span>
              </button>
              ${collapsed ? nothing : html`
                <div id="tick-${tickNum}" role="group" aria-label=${msg('Tick entries')}>
                  ${this._renderTickSummary(entries)}
                  ${entries.map((entry) => {
                    const idx = entryIndex++;
                    return this._renderEntry(entry, idx);
                  })}
                </div>
              `}
            </div>
          `;
        })}
      </div>
      ${this._entries.length < this._total ? html`
        <div class="load-more">
          <button class="load-more__btn" @click=${this._loadMore}>
            ${msg('Load older entries')}
          </button>
        </div>
      ` : nothing}
    `;
  }

  private _renderTickSummary(entries: HeartbeatEntry[]) {
    if (entries.length < 2) return nothing;

    const counts: Record<string, number> = {};
    let criticalCount = 0;
    let positiveCount = 0;

    for (const e of entries) {
      const cat = this._getSummaryCategory(e.entry_type);
      counts[cat] = (counts[cat] ?? 0) + 1;
      if (e.severity === 'critical') criticalCount++;
      if (e.severity === 'positive') positiveCount++;
    }

    const parts: string[] = [];
    if (counts['events']) parts.push(`${counts['events']} ${counts['events'] === 1 ? msg('event update') : msg('event updates')}`);
    if (counts['arcs']) parts.push(`${counts['arcs']} ${counts['arcs'] === 1 ? msg('arc shift') : msg('arc shifts')}`);
    if (counts['bureau']) parts.push(`${counts['bureau']} ${counts['bureau'] === 1 ? msg('bureau action') : msg('bureau actions')}`);
    if (counts['diplomatic']) parts.push(`${counts['diplomatic']} ${counts['diplomatic'] === 1 ? msg('diplomatic signal') : msg('diplomatic signals')}`);
    if (counts['zone']) parts.push(`${counts['zone']} ${counts['zone'] === 1 ? msg('zone change') : msg('zone changes')}`);
    if (counts['system']) parts.push(`${counts['system']} ${counts['system'] === 1 ? msg('system note') : msg('system notes')}`);

    const severityClass = criticalCount > 0 ? 'tick-summary--critical' : positiveCount > 0 ? 'tick-summary--positive' : '';

    return html`
      <div class="tick-summary ${severityClass}">
        <span class="tick-summary__text">${parts.join(' · ')}</span>
        ${criticalCount > 0 ? html`<span class="tick-summary__alert">${criticalCount} ${msg('critical')}</span>` : nothing}
      </div>
    `;
  }

  private _getSummaryCategory(type: HeartbeatEntryType): string {
    switch (type) {
      case 'event_aging':
      case 'event_escalation':
      case 'event_resolution':
      case 'resonance_pressure':
      case 'scar_tissue':
        return 'events';
      case 'narrative_arc':
      case 'cascade_spawn':
      case 'convergence':
        return 'arcs';
      case 'bureau_response':
      case 'attunement_deepen':
      case 'positive_event':
        return 'bureau';
      case 'anchor_strengthen':
        return 'diplomatic';
      case 'zone_shift':
        return 'zone';
      default:
        return 'system';
    }
  }

  private _renderEntry(entry: HeartbeatEntry, index: number) {
    const severityClass = entry.severity !== 'info' ? `entry--severity-${entry.severity}` : '';

    return html`
      <div
        class="entry entry--${entry.entry_type} ${severityClass}"
        style="animation-delay: ${index * 0.03}s"
      >
        <div class="entry__icon" aria-hidden="true">
          ${this._getEntryIcon(entry.entry_type)}
        </div>
        <div class="entry__content">
          <span class="entry__type">
            ${this._getTypeLabel(entry.entry_type)}
            ${entry.severity === 'critical' ? html`<span class="severity-badge severity-badge--critical">${msg('Critical')}</span>` : nothing}
            ${entry.severity === 'warning' ? html`<span class="severity-badge severity-badge--warning">${msg('Warning')}</span>` : nothing}
            ${entry.severity === 'positive' ? html`<span class="severity-badge severity-badge--positive">${msg('Positive')}</span>` : nothing}
          </span>
          <span class="entry__narrative">${entry.narrative_en}</span>
        </div>
        <span class="entry__meta">${this._formatRelativeTime(entry.created_at)}</span>
      </div>
    `;
  }

  private async _loadMore(): Promise<void> {
    const params: Record<string, string> = {
      limit: '100',
      offset: String(this._entries.length),
    };
    const res = await heartbeatApi.listEntries(this.simulationId, params);
    if (res.success && res.data) {
      this._entries = [...this._entries, ...(res.data as HeartbeatEntry[])];
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-pulse': VelgSimulationPulse;
  }
}
