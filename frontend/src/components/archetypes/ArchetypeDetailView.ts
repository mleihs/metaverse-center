/**
 * Archetype Detail View — Hybrid Descent + Exhibition layout.
 *
 * Route: /archetypes/:id
 * Public page (no auth required).
 *
 * Combines:
 *   - Full-screen rooms with scroll-snap (Exhibition)
 *   - Scroll-driven Authority Fracture gauge (Descent)
 *   - Archetype-specific transitions and atmosphere
 *   - Monumental typography + museum-text patterns
 *   - Boss reveal as climactic final room
 *
 * Rooms: Title → Atmosphere → Voice → Mechanic → Bestiary →
 *        Literary Wall → Encounter Preview → Vault/Loot → Exit
 */

/* lint-color-ok — archetype-specific atmospheric colors used for gallery lighting */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';
import { getArchetypeDetail } from './dungeon-detail-data.js';
import {
  type LocalizedArchetypeDetail,
  type LocalizedBanterLine,
  type LocalizedLootPreview,
  getLocalizedArchetypeDetail,
  ARCHETYPES,
} from './dungeon-detail-localized.js';
import {
  detailCardStyles,
  detailRoomStyles,
  detailTokenStyles,
} from './shared/archetype-detail-styles.js';

// Sub-components — side-effect imports for registration
import './shared/QuoteWall.js';
import './shared/EnemyCard.js';
import './shared/AuthorCard.js';
import './shared/ObjektankerCard.js';
import './shared/LootCard.js';
import './shared/EncounterCard.js';

const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/simulation.assets/showcase`;

@localized()
@customElement('velg-archetype-detail')
export class VelgArchetypeDetail extends LitElement {
  static styles = [
    detailTokenStyles,
    detailRoomStyles,
    detailCardStyles,
    css`
      /* ═══════════════════════════════════════════════════════════
         HOST — the scroll container
         ═══════════════════════════════════════════════════════════ */
      :host {
        display: block;
        height: var(--_viewport);
        overflow-y: auto;
        overflow-x: hidden;
        scroll-snap-type: y proximity;
        scroll-behavior: smooth;
        background: var(--_surface-top);
        color: var(--color-text-primary, #e5e5e5);
      }

      /* ── Scroll-driven background darkening ── */
      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: scroll()) {
          :host {
            animation: _darken-bg linear both;
            animation-timeline: scroll(self block);
          }
        }
      }

      @keyframes _darken-bg {
        0%   { background-color: var(--_surface-top); }
        25%  { background-color: var(--_surface-mid); }
        60%  { background-color: var(--_surface-deep); }
        100% { background-color: var(--_surface-abyss); }
      }

      /* ── Red vignette — intensifies as you scroll deeper ── */
      .vignette-overlay {
        position: fixed;
        top: var(--header-height, 60px);
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 50;
        background: radial-gradient(
          ellipse at center,
          transparent 40%,
          color-mix(in oklch, var(--_accent) 8%, transparent) 70%,
          color-mix(in oklch, var(--_accent) 18%, rgba(0, 0, 0, 0.4)) 100%
        );
        opacity: 0;
      }

      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: scroll()) {
          .vignette-overlay {
            animation: _vignette-in linear both;
            animation-timeline: scroll(root block);
          }
        }
      }

      @keyframes _vignette-in {
        0%   { opacity: 0; }
        30%  { opacity: 0.3; }
        60%  { opacity: 0.6; }
        100% { opacity: 1; }
      }

      /* ── Surveillance grain — Overthrow-specific texture ── */
      .grain-overlay {
        position: fixed;
        top: var(--header-height, 60px);
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 51;
        opacity: 0.025;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        background-size: 256px 256px;
      }

      @media (prefers-reduced-motion: no-preference) {
        .grain-overlay {
          animation: _grain-flicker 0.15s steps(2) infinite;
        }
      }

      @keyframes _grain-flicker {
        0%   { transform: translate(0, 0); }
        50%  { transform: translate(-2px, 1px); }
        100% { transform: translate(1px, -1px); }
      }

      /* ── Room transition accent line ── */
      .room + .room::after {
        content: '';
        position: absolute;
        top: 0;
        left: 10%;
        right: 10%;
        height: 1px;
        background: linear-gradient(
          90deg,
          transparent,
          var(--_accent-border) 20%,
          var(--_accent) 50%,
          var(--_accent-border) 80%,
          transparent
        );
        z-index: 3;
        opacity: 0.4;
      }

      /* ── Mirror line — the Spiegelpalast signature ── */
      .mirror-line {
        position: fixed;
        top: var(--header-height, 60px);
        left: 50%;
        width: 1px;
        height: var(--_viewport);
        background: linear-gradient(
          180deg,
          transparent 0%,
          var(--_accent-border) 20%,
          var(--_accent-border) 80%,
          transparent 100%
        );
        opacity: 0.04;
        z-index: 100;
        pointer-events: none;
      }

      /* ═══════════════════════════════════════════════════════════
         GAUGE — sticky right sidebar, scroll-driven fill
         ═══════════════════════════════════════════════════════════ */
      .gauge {
        position: fixed;
        right: var(--space-4, 16px);
        top: calc(var(--header-height, 60px) + var(--_viewport) / 2);
        transform: translateY(-50%);
        width: 4px;
        height: 40vh;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 2px;
        z-index: 200;
        overflow: hidden;
      }

      .gauge__fill {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 0%;
        border-radius: 2px;
        background: var(--_accent);
        transition: height 0.3s linear;
      }

      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: scroll()) {
          .gauge__fill {
            animation: _fill-gauge linear both;
            animation-timeline: scroll(root block);
            transition: none;
          }
        }
      }

      @keyframes _fill-gauge {
        from { height: 0%; background-color: var(--color-text-muted, #666); }
        20%  { background-color: color-mix(in oklch, var(--_accent) 30%, var(--color-text-muted, #666)); }
        40%  { background-color: color-mix(in oklch, var(--_accent) 55%, var(--color-text-muted, #666)); }
        60%  { background-color: var(--_accent); }
        80%  { background-color: var(--_accent); box-shadow: 0 0 8px var(--_accent-glow); }
        to   { height: 100%; background-color: #ff1a1a; box-shadow: 0 0 16px rgba(255, 26, 26, 0.5); }
      }

      .gauge__label {
        position: absolute;
        right: 12px;
        font-family: var(--_font-prose);
        font-size: 0.6rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
        white-space: nowrap;
        pointer-events: none;
      }

      .gauge__label--top { top: -16px; }
      .gauge__label--bottom { bottom: -16px; color: var(--_accent); }

      @media (max-width: 768px) {
        .gauge { right: var(--space-2, 8px); width: 3px; height: 30vh; }
        .gauge__label { display: none; }
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 1: TITLE WALL
         ═══════════════════════════════════════════════════════════ */
      .room--title {
        background: var(--_surface-abyss);
        --_light-x: 50%;
        --_light-y: 30%;
      }

      .title__numeral {
        font-family: var(--_font-prose);
        font-size: clamp(0.7rem, 1vw, 0.85rem);
        font-weight: 400;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: var(--_accent);
        opacity: 0.6;
        margin-bottom: var(--space-4, 16px);
      }

      .title__name {
        font-family: var(--_font-display);
        font-size: var(--_monument-size);
        font-weight: var(--_monument-weight);
        letter-spacing: var(--_monument-tracking);
        text-transform: uppercase;
        line-height: 0.95;
        color: var(--color-text-primary, #e5e5e5);
        text-shadow: 0 0 80px var(--_accent-glow);
        text-align: center;
        margin: 0;
      }

      .title__subtitle {
        font-family: var(--_font-prose);
        font-size: clamp(1rem, 2.2vw, 1.5rem);
        font-style: italic;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--_accent);
        opacity: 0.85;
        margin-top: var(--space-2, 8px);
      }

      .title__divider {
        width: 60px;
        height: 1px;
        background: var(--_accent);
        opacity: 0.4;
        margin: var(--space-6, 24px) 0;
        box-shadow: 0 0 12px var(--_accent-glow);
      }

      .title__signature {
        font-family: var(--_font-prose);
        font-size: 0.78rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
      }

      .title__tagline {
        font-family: var(--_font-prose);
        font-size: clamp(0.95rem, 1.3vw, 1.15rem);
        font-style: italic;
        line-height: 1.6;
        color: var(--color-text-secondary, #a0a0a0);
        max-width: 50ch;
        margin: var(--space-4, 16px) 0 0;
        opacity: 0.7;
        text-shadow: 0 0 20px var(--_accent-glow);
      }

      .title__gauge-hint {
        font-family: var(--_font-prose);
        font-size: 0.8rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
        margin-top: var(--space-6, 24px);
        opacity: 0.5;
      }

      .title__scroll-hint {
        font-family: var(--_font-prose);
        font-size: 0.8rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
        margin-top: var(--space-8, 32px);
        opacity: 0.4;
      }

      @media (prefers-reduced-motion: no-preference) {
        .title__scroll-hint {
          animation: _bounce-down 2s ease-in-out 3s infinite;
        }
        .title__tagline {
          animation: _title-fade-in 1.2s var(--_ease-dramatic) 1.2s both;
        }
        .title__gauge-hint {
          animation: _title-fade-in 1s var(--_ease-dramatic) 1.5s both;
        }
        .title__scroll-hint {
          animation:
            _title-fade-in 1s var(--_ease-dramatic) 1.8s both,
            _bounce-down 2s ease-in-out 3s infinite;
        }
      }

      @keyframes _bounce-down {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(6px); }
      }

      /* Entrance animation */
      @media (prefers-reduced-motion: no-preference) {
        .title__name {
          animation: _title-fade-in 2s var(--_ease-dramatic) both;
        }
        .title__subtitle {
          animation: _title-fade-in 1.5s var(--_ease-dramatic) 0.5s both;
        }
        .title__divider {
          animation: _title-fade-in 1s var(--_ease-dramatic) 0.8s both;
        }
        .title__numeral,
        .title__signature {
          animation: _title-fade-in 1s var(--_ease-dramatic) 1s both;
        }
      }

      @keyframes _title-fade-in {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Slow political heartbeat pulse on title */
      @media (prefers-reduced-motion: no-preference) {
        .title__name {
          animation:
            _title-fade-in 2s var(--_ease-dramatic) both,
            _heartbeat 4s ease-in-out 2.5s infinite;
        }
      }

      @keyframes _heartbeat {
        0%, 100% { text-shadow: 0 0 80px var(--_accent-glow); }
        50%      { text-shadow: 0 0 120px color-mix(in oklch, var(--_accent) 50%, transparent); }
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 2: ATMOSPHERE (Key Art)
         ═══════════════════════════════════════════════════════════ */
      .room--atmosphere {
        padding: var(--space-8, 32px);
        padding-bottom: var(--space-12, 48px);
        justify-content: flex-end;
        align-items: flex-start;
        --_light-x: 50%;
        --_light-y: 20%;
      }

      .room--atmosphere .room__bg {
        opacity: 0.7;
        inset: 0;
      }

      .atmosphere__label {
        position: relative;
        z-index: 3;
      }

      @media (max-width: 768px) {
        .room--atmosphere {
          padding: var(--space-5, 20px);
          padding-bottom: var(--space-10, 40px);
        }
        .atmosphere__label {
          max-width: none;
        }
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 2.5: LORE INTRO — threshold text
         ═══════════════════════════════════════════════════════════ */
      .room--lore-intro {
        --_light-x: 50%;
        --_light-y: 35%;
      }

      .lore-intro__entrance {
        font-family: var(--_font-prose);
        font-size: var(--_exhibit-size);
        font-style: italic;
        line-height: var(--_exhibit-leading);
        color: var(--_accent);
        opacity: 0.75;
        max-width: 60ch;
        margin-bottom: var(--space-8, 32px);
        padding-left: var(--space-5, 20px);
        border-left: 2px solid var(--_accent-border);
      }

      .lore-intro__body {
        max-width: 65ch;
        display: flex;
        flex-direction: column;
        gap: var(--space-5, 20px);
      }

      .lore-intro__paragraph {
        font-family: var(--_font-prose);
        font-size: var(--_body-size);
        line-height: 1.75;
        color: var(--color-text-secondary, #a0a0a0);
      }

      /* Drop cap on first paragraph */
      .lore-intro__paragraph:first-child::first-letter {
        font-family: var(--_font-display);
        font-size: 3.5em;
        float: left;
        line-height: 0.8;
        padding-right: 8px;
        padding-top: 4px;
        color: var(--_accent);
        font-weight: 700;
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 3: VOICE (Quote)
         ═══════════════════════════════════════════════════════════ */
      .room--voice {
        background: var(--_surface-abyss);
        --_light-x: 50%;
        --_light-y: 50%;
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 4: MECHANIC
         ═══════════════════════════════════════════════════════════ */
      .room--mechanic {
        --_light-x: 50%;
        --_light-y: 25%;
      }

      .mechanic-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-8, 32px);
        align-items: start;
        max-width: 1000px;
        width: 100%;
      }

      @media (max-width: 768px) {
        .mechanic-layout { grid-template-columns: 1fr; }
      }

      .mechanic__gauge-display {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
      }

      .gauge-visual {
        width: 100%;
        height: 12px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        overflow: hidden;
        margin: var(--space-3, 12px) 0;
      }

      .gauge-visual__fill {
        height: 100%;
        border-radius: 6px;
        background: linear-gradient(90deg, var(--color-text-muted, #666) 0%, var(--_accent) 60%, #ff1a1a 100%);
        width: 42%;
        transition: width 1.5s var(--_ease-dramatic);
      }

      .gauge-visual__value {
        text-align: center;
        font-family: var(--_font-prose);
        font-size: 1.2rem;
        font-weight: 500;
        color: var(--_accent);
      }

      .threshold-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .threshold {
        display: flex;
        align-items: baseline;
        gap: 10px;
        font-family: var(--_font-prose);
        font-size: 0.85rem;
        color: var(--color-text-secondary, #a0a0a0);
      }

      .threshold__label {
        min-width: 100px;
        font-weight: 600;
        color: var(--color-text-primary, #e5e5e5);
      }

      .threshold__range {
        min-width: 45px;
        font-style: italic;
        color: var(--color-text-muted, #888);
      }

      .mechanic__text {
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
      }

      .mechanic__block {
        padding: var(--space-3, 12px) 0;
      }

      .mechanic__block-title {
        font-family: var(--_font-prose);
        font-size: 0.9rem;
        font-weight: 600;
        font-style: italic;
        color: var(--_accent);
        margin-bottom: 6px;
      }

      .mechanic__block-text {
        font-family: var(--_font-prose);
        font-size: 0.92rem;
        line-height: 1.65;
        color: var(--color-text-secondary, #a0a0a0);
      }

      .aptitude-chart {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: var(--space-3, 12px);
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 5: BESTIARY
         ═══════════════════════════════════════════════════════════ */
      .room--bestiary {
        --_light-x: 50%;
        --_light-y: 30%;
      }

      .bestiary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-4, 16px);
        width: 100%;
      }

      .bestiary-grid > :last-child {
        grid-column: 1 / -1;
      }

      @media (max-width: 640px) {
        .bestiary-grid { grid-template-columns: 1fr; }
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 6: LITERARY WALL
         ═══════════════════════════════════════════════════════════ */
      .room--literary {
        --_light-x: 50%;
        --_light-y: 25%;
        --_bg-opacity: 0.2;
      }

      .literary-header {
        text-align: center;
        margin-bottom: var(--space-8, 32px);
      }

      .literary-header__quote {
        font-family: var(--_font-prose);
        font-size: clamp(1.1rem, 2vw, 1.5rem);
        font-style: italic;
        color: var(--_accent);
        opacity: 0.7;
        max-width: 50ch;
        margin: var(--space-4, 16px) auto 0;
        line-height: 1.5;
      }

      .authors-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--space-3, 12px);
        width: 100%;
      }

      @media (max-width: 640px) {
        .authors-grid { grid-template-columns: 1fr; }
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 6.5: BANTER INTERLUDE
         ═══════════════════════════════════════════════════════════ */
      /* ── Banter: Pull-quote interstitials with atmosphere ── */
      .banter-section {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        padding: var(--space-12, 48px) var(--space-8, 32px);
        gap: var(--space-10, 40px);
        overflow: hidden;
      }

      /* Background image for visual weight */
      .banter-section__bg {
        position: absolute;
        inset: -10% 0;
        z-index: 0;
        background: var(--_banter-bg) center / cover no-repeat;
        opacity: 0.40;
        pointer-events: none;
      }

      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: view()) {
          .banter-section__bg {
            animation: _parallax-shift linear both;
            animation-timeline: view();
            animation-range: cover;
          }
        }
      }

      .banter-section__header {
        position: relative;
        z-index: 1;
        font-family: var(--_font-prose);
        font-size: 0.82rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
      }

      .banter-whisper {
        position: relative;
        z-index: 1;
        font-family: var(--_font-prose);
        font-size: clamp(1.1rem, 1.5vw + 0.4rem, 1.4rem);
        font-style: italic;
        line-height: 1.75;
        color: var(--color-text-primary, #e5e5e5);
        max-width: 55ch;
        text-align: center;
        padding: var(--space-6, 24px) 0;
        /* Horizontal accent lines above and below */
        background-image:
          linear-gradient(90deg, transparent, var(--_accent-border) 30%, var(--_accent-border) 70%, transparent),
          linear-gradient(90deg, transparent, var(--_accent-border) 30%, var(--_accent-border) 70%, transparent);
        background-size: 200px 1px, 200px 1px;
        background-position: center top, center bottom;
        background-repeat: no-repeat;
      }

      /* ── Scroll-driven: emerge, glow, recede ── */
      @media (prefers-reduced-motion: no-preference) {
        @supports (animation-timeline: view()) {
          .banter-whisper {
            animation: _whisper-emerge linear both;
            animation-timeline: view();
            animation-range: cover;
          }
        }
      }

      @keyframes _whisper-emerge {
        entry 0%    { opacity: 0; transform: translateY(2rem) scale(0.96); }
        entry 100%  { opacity: 1; transform: translateY(0) scale(1); }
        contain 30% { text-shadow: 0 0 40px var(--_accent-glow); }
        contain 70% { text-shadow: 0 0 40px var(--_accent-glow); }
        exit 0%     { opacity: 1; transform: translateY(0) scale(1); }
        exit 100%   { opacity: 0; transform: translateY(-1.5rem) scale(0.97); }
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 7: ENCOUNTERS
         ═══════════════════════════════════════════════════════════ */
      .room--encounters {
        --_light-x: 50%;
        --_light-y: 35%;
      }

      .encounters-layout {
        display: flex;
        flex-direction: column;
        gap: var(--space-6, 24px);
        width: 100%;
      }

      .encounters-layout > :nth-child(odd) {
        align-self: flex-start;
        max-width: 85%;
      }

      .encounters-layout > :nth-child(even) {
        align-self: flex-end;
        max-width: 85%;
      }

      @media (max-width: 768px) {
        .encounters-layout > :nth-child(odd),
        .encounters-layout > :nth-child(even) {
          align-self: stretch;
          max-width: 100%;
        }
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 8: VAULT (Objektanker + Loot)
         ═══════════════════════════════════════════════════════════ */
      .room--vault {
        --_light-x: 50%;
        --_light-y: 40%;
      }

      .vault-section {
        width: 100%;
        margin-bottom: var(--space-8, 32px);
      }

      .vault-section__title {
        font-family: var(--_font-prose);
        font-size: 0.88rem;
        font-weight: 500;
        font-style: italic;
        color: var(--color-text-muted, #888);
        margin-bottom: var(--space-4, 16px);
      }

      .objektanker-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: var(--space-3, 12px);
      }

      .loot-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--space-3, 12px);
      }

      @media (max-width: 640px) {
        .objektanker-grid,
        .loot-grid { grid-template-columns: 1fr; }
      }

      .loot-tier-header {
        grid-column: 1 / -1;
        font-family: var(--_font-prose);
        font-size: 0.82rem;
        font-weight: 500;
        font-style: italic;
        color: var(--color-text-muted, #888);
        padding-top: var(--space-3, 12px);
        border-top: 1px solid rgba(255, 255, 255, 0.04);
      }

      .loot-tier-header:first-child {
        border-top: none;
        padding-top: 0;
      }

      /* ═══════════════════════════════════════════════════════════
         ROOM 9: EXIT + CTA
         ═══════════════════════════════════════════════════════════ */
      .room--exit {
        background: var(--_surface-abyss);
        --_light-x: 50%;
        --_light-y: 40%;
      }

      .exit__collapse {
        font-family: var(--_font-display);
        font-size: clamp(1.5rem, 4vw, 2.5rem);
        font-weight: var(--_monument-weight);
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--_accent);
        text-shadow:
          0 0 40px var(--_accent-glow),
          0 0 80px color-mix(in oklch, var(--_accent) 40%, transparent);
        margin-bottom: var(--space-4, 16px);
        text-align: center;
      }

      .exit__gauge-full {
        font-family: var(--_font-prose);
        font-size: 0.88rem;
        font-style: italic;
        color: var(--_accent);
        opacity: 0.7;
        margin-bottom: var(--space-6, 24px);
      }

      .exit__quote {
        font-family: var(--_font-prose);
        font-size: clamp(1rem, 2vw, 1.3rem);
        font-style: italic;
        line-height: 1.6;
        color: var(--color-text-primary, #e5e5e5);
        text-align: center;
        max-width: 50ch;
        margin-bottom: var(--space-8, 32px);
        text-shadow: 0 0 40px var(--_accent-glow);
      }

      .exit__cta-text {
        font-family: var(--_font-prose);
        font-size: 0.95rem;
        color: var(--color-text-secondary, #a0a0a0);
        margin-bottom: var(--space-6, 24px);
        text-align: center;
      }

      .exit__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 14px 40px;
        font-family: var(--_font-display);
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--color-text-primary, #e5e5e5);
        background: color-mix(in oklch, var(--_accent) 20%, transparent);
        border: 1px solid var(--_accent);
        border-radius: 4px;
        text-decoration: none;
        cursor: pointer;
        transition: background 0.3s, box-shadow 0.3s;
      }

      .exit__cta:hover {
        background: color-mix(in oklch, var(--_accent) 35%, transparent);
        box-shadow: 0 0 24px var(--_accent-glow);
      }

      @media (prefers-reduced-motion: no-preference) {
        .exit__cta {
          animation: _cta-pulse 2s ease-in-out infinite;
        }
      }

      @keyframes _cta-pulse {
        0%, 100% { box-shadow: 0 0 8px var(--_accent-glow); }
        50%      { box-shadow: 0 0 24px var(--_accent-glow); }
      }

      .exit__nav {
        display: flex;
        justify-content: center;
        gap: var(--space-6, 24px);
        margin-top: var(--space-8, 32px);
        flex-wrap: wrap;
      }

      .exit__nav-link {
        font-family: var(--_font-prose);
        font-size: 0.88rem;
        color: var(--color-text-muted, #888);
        text-decoration: none;
        transition: color 0.2s;
      }

      .exit__nav-link:hover { color: var(--_accent); }

      .exit__back {
        margin-top: var(--space-4, 16px);
        font-family: var(--_font-prose);
        font-size: 0.82rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
        text-decoration: none;
      }

      .exit__back:hover { color: var(--color-text-secondary, #a0a0a0); }

      /* ═══════════════════════════════════════════════════════════
         NOT FOUND
         ═══════════════════════════════════════════════════════════ */
      .not-found {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: var(--_viewport);
        gap: var(--space-4, 16px);
        text-align: center;
        padding: var(--space-8, 32px);
      }

      .not-found__title {
        font-family: var(--_font-display);
        font-size: var(--_section-size);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .not-found__text {
        color: var(--color-text-secondary, #a0a0a0);
        max-width: 45ch;
      }

      .not-found__link {
        color: var(--_accent);
        text-decoration: none;
      }
    `,
  ];

  @property() archetypeId = '';
  /** Whether an archetype with this id exists (for not-found detection). */
  @state() private _hasData = false;
  @state() private _gaugeAnimated = false;

  connectedCallback() {
    super.connectedCallback();
    this._initArchetype();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('archetypeId')) {
      this._initArchetype();
    }
  }

  /** One-time setup: SEO, analytics, gauge animation. Uses raw EN data for SEO. */
  private _initArchetype() {
    if (!this.archetypeId) return;
    const data = getArchetypeDetail(this.archetypeId);
    this._hasData = !!data;

    if (data) {
      seoService.setTitle([data.name, data.subtitle]);
      seoService.setDescription(data.tagline);
      seoService.setCanonical(`/archetypes/${data.id}`);
      seoService.setBreadcrumbs([
        { name: 'Home', url: 'https://metaverse.center/' },
        { name: 'Archetypes', url: 'https://metaverse.center/' },
        { name: data.name, url: `https://metaverse.center/archetypes/${data.id}` },
      ]);
      analyticsService.trackPageView(`/archetypes/${data.id}`, document.title);

      // Trigger gauge animation after first paint
      requestAnimationFrame(() => {
        this._gaugeAnimated = true;
      });
    }
  }

  protected render() {
    if (!this._hasData) {
      return this.archetypeId ? this._renderNotFound() : nothing;
    }

    // Compute localized data fresh on each render — @localized() triggers
    // re-renders on locale change, so this always reflects the current locale.
    const d = getLocalizedArchetypeDetail(this.archetypeId)!;
    const imageUrl = `${STORAGE_BASE}/dungeon-${d.id}.avif`;
    const depthUrl = `${STORAGE_BASE}/dungeon-${d.id}-depth.avif`;
    const whispersUrl = `${STORAGE_BASE}/dungeon-${d.id}-whispers.avif`;
    const revolutionUrl = `${STORAGE_BASE}/dungeon-${d.id}-revolution.avif`;
    const bossUrl = `${STORAGE_BASE}/dungeon-${d.id}-boss.avif`;

    return html`
      <div class="vignette-overlay" aria-hidden="true"></div>
      <div class="grain-overlay" aria-hidden="true"></div>
      <div class="mirror-line" aria-hidden="true"></div>

      ${this._renderGauge(d)}

      <section class="room room--title" role="region" aria-label=${msg('Title')}>
        <div class="room__content" style="display:flex;flex-direction:column;align-items:center;text-align:center;">
          <div class="title__numeral">${d.numeral} / VIII</div>
          <h1 class="title__name">${d.name.replace('The ', '').toUpperCase()}</h1>
          <div class="title__subtitle">${d.subtitle}</div>
          <div class="title__divider" aria-hidden="true"></div>
          <div class="title__signature">${msg('Resonance Archetype')} ${d.numeral} \u00b7 ${d.mechanicName}</div>
          <p class="title__tagline">${d.tagline}</p>
          <div class="title__gauge-hint">${d.mechanicName}: 0 / ${d.mechanicGauge.max}</div>
          <div class="title__scroll-hint" aria-hidden="true">\u2193 ${msg('Descend')}</div>
        </div>
      </section>

      ${this._renderAtmosphereRoom(d, imageUrl)}
      ${this._renderLoreIntroRoom(d)}
      ${this._renderVoiceRoom(d)}
      ${this._renderMechanicRoom(d)}
      ${this._renderBestiaryRoom(d, depthUrl)}
      ${this._renderQuoteBreak(d, 1)}
      ${this._renderEncounterRoom(d)}
      ${this._renderBanterInterlude(d.banterSamples.filter((b) => b.tier <= 1), whispersUrl)}
      ${this._renderLiteraryRoom(d, depthUrl)}
      ${this._renderBanterInterlude(d.banterSamples.filter((b) => b.tier >= 2), revolutionUrl)}
      ${this._renderVaultRoom(d)}
      ${this._renderQuoteBreak(d, 2)}
      ${this._renderExitRoom(d, bossUrl)}
    `;
  }

  // ── Gauge ──────────────────────────────────────────────────────────────────

  private _renderGauge(d: LocalizedArchetypeDetail): TemplateResult {
    const gauge = d.mechanicGauge;
    return html`
      <div class="gauge" role="progressbar" aria-label=${gauge.name}
           aria-valuenow="0" aria-valuemin="0" aria-valuemax=${gauge.max}>
        <div class="gauge__fill"></div>
        <span class="gauge__label gauge__label--top">${gauge.thresholds[0]?.label}</span>
        <span class="gauge__label gauge__label--bottom">${gauge.thresholds.at(-1)?.label}</span>
      </div>
    `;
  }

  // ── Room 2: Atmosphere ─────────────────────────────────────────────────────

  private _renderAtmosphereRoom(d: LocalizedArchetypeDetail, imageUrl: string): TemplateResult {
    return html`
      <section class="room room--atmosphere" role="region" aria-label=${msg('Key Art')}>
        <div class="room__bg room__bg--parallax"
             style="--_bg-url:url('${imageUrl}')">
        </div>
        <div class="atmosphere__label museum-label">
          <blockquote>${d.tagline}</blockquote>
          <div class="museum-label__category">${msg('Archetype')} ${d.numeral}</div>
          <div>${d.subtitle} \u00b7 ${d.mechanicName}</div>
        </div>
      </section>
    `;
  }

  // ── Room 3: Voice (Quote) ──────────────────────────────────────────────────

  // ── Quote Break (reusable) ───────────────────────────────────────────────

  private _renderQuoteBreak(d: LocalizedArchetypeDetail, index: number): TemplateResult {
    // Quote 0 = Voice Room (rendered separately), 1 = after Bestiary, 2 = final warning
    const quoteIdx = index === 1 ? 1 : 2; // Machiavelli (1), Brecht (2)
    const quote = d.quotes[quoteIdx];
    if (!quote) return html``;

    return html`
      <section class="room room--voice" role="region"
               aria-label=${msg('Quotation')}>
        <div class="room__content room__reveal" style="display:flex;justify-content:center;">
          <velg-quote-wall
            .text=${quote.text}
            .author=${quote.author}
            .original=${quote.original ?? ''}
            .originalLang=${quote.originalLang ?? ''}
            style="--_accent:${d.accent}"
          ></velg-quote-wall>
        </div>
      </section>
    `;
  }

  // ── Room 2.5: Lore Intro ────────────────────────────────────────────────

  private _renderLoreIntroRoom(d: LocalizedArchetypeDetail): TemplateResult {
    // Pick a random entrance text (deterministic: based on archetype id length)
    const entranceIdx = d.id.length % d.entranceTexts.length;
    const entrance = d.entranceTexts[entranceIdx];

    return html`
      <section class="room room--lore-intro room--grow" role="region"
               aria-label=${msg('Introduction')}>
        <div class="room__content room__reveal">
          <h2 class="section-header">${d.subtitle}</h2>
          <blockquote class="lore-intro__entrance">${entrance}</blockquote>
          <div class="lore-intro__body">
            ${d.loreIntro.map(
              (p) => html`<p class="lore-intro__paragraph">${p}</p>`,
            )}
          </div>
        </div>
      </section>
    `;
  }

  // ── Room 3: Voice (Quote) ──────────────────────────────────────────────────

  private _renderVoiceRoom(d: LocalizedArchetypeDetail): TemplateResult {
    // Pick the most dramatic quote (prefer non-banter, with original language)
    const quote = d.quotes.find((q) => q.original) ?? d.quotes[0];
    if (!quote) return html``;

    return html`
      <section class="room room--voice" role="region" aria-label=${msg('Literary Voice')}>
        <div class="room__content room__reveal" style="display:flex;justify-content:center;">
          <velg-quote-wall
            .text=${quote.text}
            .author=${quote.author}
            .original=${quote.original ?? ''}
            .originalLang=${quote.originalLang ?? ''}
            style="--_accent:${d.accent}"
          ></velg-quote-wall>
        </div>
      </section>
    `;
  }

  // ── Room 4: Mechanic ───────────────────────────────────────────────────────

  private _renderMechanicRoom(d: LocalizedArchetypeDetail): TemplateResult {
    const gauge = d.mechanicGauge;
    const maxWeight = Math.max(...Object.values(d.aptitudeWeights));

    return html`
      <section class="room room--mechanic room--grow" role="region" aria-label=${d.mechanicName}>
        <div class="room__content room__reveal">
          <h2 class="section-header">${d.mechanicName}</h2>
          <p class="prose" style="margin-bottom:var(--space-6,24px)">${d.mechanicDescription}</p>

          <div class="mechanic-layout">
            <div class="mechanic__gauge-display">
              <div class="gauge-visual">
                <div class="gauge-visual__fill" style="width:${this._gaugeAnimated ? 42 : 0}%"></div>
              </div>
              <div class="gauge-visual__value">42 / ${gauge.max}</div>

              <div class="threshold-list">
                ${gauge.thresholds.map(
                  (t) => html`
                    <div class="threshold">
                      <span class="threshold__label">${t.label}</span>
                      <span class="threshold__range">${t.value === 100 ? '100' : `${t.value}\u2013${t.value + 19}`}</span>
                      <span>${t.description}</span>
                    </div>
                  `,
                )}
              </div>
            </div>

            <div class="mechanic__text">
              <div class="mechanic__block">
                <div class="mechanic__block-title">${msg('Fracture Gain')}</div>
                <div class="mechanic__block-text">
                  +4 per room (shallow) \u2192 +10 per room (deep)<br>
                  +2 per combat round<br>
                  +5 on failed diplomacy
                </div>
              </div>
              <div class="mechanic__block">
                <div class="mechanic__block-title">${msg('Fracture Reduction')}</div>
                <div class="mechanic__block-text">
                  \u22125 on rest (brief respite)<br>
                  \u221210 on rally (Propagandist ability)<br>
                  <em style="color:var(--_accent);opacity:0.7">${msg('Violence does not restore order.')}</em>
                </div>
              </div>
              <div class="mechanic__block">
                <div class="mechanic__block-title">${msg('Critical Aptitudes')}</div>
                <div class="aptitude-chart">
                  ${Object.entries(d.aptitudeWeights).map(
                    ([name, weight]) => html`
                      <div class="aptitude-row">
                        <span class="aptitude-row__label">${name}</span>
                        <div class="aptitude-row__bar">
                          <div class="aptitude-row__fill"
                               style="width:${this._gaugeAnimated ? (weight / maxWeight) * 100 : 0}%">
                          </div>
                        </div>
                        <span class="aptitude-row__value">${weight}</span>
                      </div>
                    `,
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // ── Room 5: Bestiary ───────────────────────────────────────────────────────

  private _renderBestiaryRoom(d: LocalizedArchetypeDetail, depthUrl: string): TemplateResult {
    return html`
      <section class="room room--bestiary room--grow" role="region" aria-label=${msg('Bestiary')}>
        <div class="room__bg room__bg--parallax"
             style="--_bg-url:url('${depthUrl}');--_bg-opacity:0.40">
        </div>
        <div class="room__content room__reveal">
          <h2 class="section-header">${msg('Bestiary')}</h2>
          <p class="prose" style="margin-bottom:var(--space-6,24px)">
            ${msg('The denizens of Der Spiegelpalast. Not monsters \u2013 operatives.')}
          </p>
          <div class="bestiary-grid">
            ${d.enemies.map(
              (e) => html`
                <velg-enemy-card
                  .name=${e.name}
                  .nameAlt=${e.nameAlt}
                  tier=${e.tier}
                  .power=${e.power}
                  .stress=${e.stress}
                  .evasion=${e.evasion}
                  .ability=${e.ability}
                  .aptitude=${e.aptitude}
                  .description=${e.description}
                  style="--_accent:${d.accent}"
                ></velg-enemy-card>
              `,
            )}
          </div>
        </div>
      </section>
    `;
  }

  // ── Banter Interlude ───────────────────────────────────────────────────────

  private _renderBanterInterlude(lines: readonly LocalizedBanterLine[], bgUrl: string): TemplateResult {
    if (!lines.length) return html``;
    const selected = lines.slice(0, 3);
    return html`
      <div class="banter-section" aria-label=${msg('Whispers')}>
        <div class="banter-section__bg" style="--_banter-bg:url('${bgUrl}')" aria-hidden="true"></div>
        <p class="banter-section__header">${msg('Overheard in the Spiegelpalast')}</p>
        ${selected.map(
          (b) => html`<p class="banter-whisper">${b.text}</p>`,
        )}
      </div>
    `;
  }

  // ── Room 6: Literary Wall ──────────────────────────────────────────────────

  private _renderLiteraryRoom(d: LocalizedArchetypeDetail, imageUrl: string): TemplateResult {
    // Find a Brecht or other German quote for the header
    const headerQuote = d.authors.find((a) => a.quote && a.language === 'Deutsch')?.quote
      ?? d.authors.find((a) => a.quote)?.quote ?? '';

    return html`
      <section class="room room--literary room--grow" role="region"
               aria-label=${msg('Literary Influences')}>
        <div class="room__bg room__bg--parallax"
             style="--_bg-url:url('${imageUrl}');--_bg-opacity:0.30">
        </div>
        <div class="room__content room__reveal">
          <div class="literary-header">
            <h2 class="section-header">${msg('The Authors Who Forged This Place')}</h2>
            ${headerQuote
              ? html`<p class="literary-header__quote">\u201c${headerQuote}\u201d</p>`
              : nothing}
          </div>
          <div class="authors-grid">
            ${d.authors.map(
              (a) => html`
                <velg-author-card
                  .name=${a.name}
                  .works=${a.works}
                  .concept=${a.concept}
                  .language=${a.language}
                  .quote=${a.quote ?? ''}
                  ?primary=${a.primary}
                  style="--_accent:${d.accent}"
                ></velg-author-card>
              `,
            )}
          </div>
        </div>
      </section>
    `;
  }

  // ── Room 7: Encounters ─────────────────────────────────────────────────────

  private _renderEncounterRoom(d: LocalizedArchetypeDetail): TemplateResult {
    return html`
      <section class="room room--encounters room--grow" role="region"
               aria-label=${msg('Encounters')}>
        <div class="room__content room__reveal">
          <h2 class="section-header">${msg('Encounters')}</h2>
          <p class="prose" style="margin-bottom:var(--space-6,24px)">
            ${msg('Navigate political crises. Every choice shifts the balance of power.')}
          </p>
          <div class="encounters-layout">
            ${d.encounterPreviews.map(
              (enc) => html`
                <velg-encounter-card
                  .name=${enc.name}
                  .depth=${enc.depth}
                  .type=${enc.type}
                  .description=${enc.description}
                  .choices=${enc.choices ?? []}
                  style="--_accent:${d.accent}"
                ></velg-encounter-card>
              `,
            )}
          </div>
        </div>
      </section>
    `;
  }

  // ── Room 8: Vault ──────────────────────────────────────────────────────────

  private _renderVaultRoom(d: LocalizedArchetypeDetail): TemplateResult {
    const tier1 = d.lootShowcase.filter((l) => l.tier === 1);
    const tier2 = d.lootShowcase.filter((l) => l.tier === 2);
    const tier3 = d.lootShowcase.filter((l) => l.tier === 3);

    return html`
      <section class="room room--vault room--grow" role="region"
               aria-label=${msg('Artifacts & Loot')}>
        <div class="room__content room__reveal">
          <!-- Objektanker -->
          <div class="vault-section">
            <h2 class="section-header">${msg('Artifacts of the Spiegelpalast')}</h2>
            <p class="prose" style="margin-bottom:var(--space-5,20px)">
              ${msg('Objects that mutate as the dungeon descends. Each tells the story of power corrupted.')}
            </p>
            <div class="objektanker-grid">
              ${d.objektanker.map(
                (o) => html`
                  <velg-objektanker-card
                    .name=${o.name}
                    .phases=${o.phases}
                    style="--_accent:${d.accent}"
                  ></velg-objektanker-card>
                `,
              )}
            </div>
          </div>

          <!-- Loot -->
          <div class="vault-section">
            <h2 class="section-header" style="margin-top:var(--space-6,24px)">${msg('Spoils')}</h2>
            <div class="loot-grid">
              ${this._renderLootTier(msg('Tier I \u2013 Minor'), tier1, d.accent)}
              ${this._renderLootTier(msg('Tier II \u2013 Major'), tier2, d.accent)}
              ${this._renderLootTier(msg('Tier III \u2013 Legendary'), tier3, d.accent)}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  private _renderLootTier(label: string, items: readonly LocalizedLootPreview[], accent: string): TemplateResult {
    if (!items.length) return html``;
    return html`
      <div class="loot-tier-header">${label}</div>
      ${items.map(
        (l) => html`
          <velg-loot-card
            .name=${l.name}
            .tier=${l.tier}
            .effect=${l.effect}
            .description=${l.description}
            style="--_accent:${accent}"
          ></velg-loot-card>
        `,
      )}
    `;
  }

  // ── Room 9: Exit ───────────────────────────────────────────────────────────

  private _renderExitRoom(d: LocalizedArchetypeDetail, bossUrl: string): TemplateResult {
    return html`
      <section class="room room--exit" role="region" aria-label=${msg('Conclusion')}>
        <div class="room__bg room__bg--parallax"
             style="--_bg-url:url('${bossUrl}');--_bg-opacity:0.45">
        </div>
        <div class="room__content room__reveal" style="display:flex;flex-direction:column;align-items:center;">
          <div class="exit__gauge-full">${d.mechanicName}: ${d.mechanicGauge.max} / ${d.mechanicGauge.max}</div>
          <div class="exit__collapse">\u2620 ${d.mechanicGauge.thresholds.at(-1)?.label ?? 'COLLAPSE'} \u2620</div>

          <blockquote class="exit__quote">
            ${msg('The old leader is gone. The new leader enters. Same room. Same desk. Same view from the window.')}
          </blockquote>

          <p class="exit__cta-text">
            ${msg('You survived the exhibition. Now survive the dungeon.')}
          </p>

          <a class="exit__cta" href="/">${msg('Enter the Spiegelpalast')}</a>

          <nav class="exit__nav" aria-label=${msg('Archetype Navigation')}>
            <a class="exit__nav-link" href="/archetypes/${d.prevArchetype.id}">
              \u2190 ${d.prevArchetype.numeral} \u00b7 ${d.prevArchetype.name}
            </a>
            <a class="exit__nav-link" href="/archetypes/${d.nextArchetype.id}">
              ${d.nextArchetype.numeral} \u00b7 ${d.nextArchetype.name} \u2192
            </a>
          </nav>

          <a class="exit__back" href="/#dungeons">\u2190 ${msg('All Archetypes')}</a>
        </div>
      </section>
    `;
  }

  // ── Not Found ──────────────────────────────────────────────────────────────

  private _renderNotFound(): TemplateResult {
    return html`
      <div class="not-found">
        <h1 class="not-found__title">${msg('Archetype Not Found')}</h1>
        <p class="not-found__text">
          ${msg('This archetype detail page is not available yet.')}
        </p>
        <p>
          ${msg('Available archetypes:')}
          ${ARCHETYPES.map(
            (a) => html`<a class="not-found__link" href="/archetypes/${a.id}">${a.name}</a> `,
          )}
        </p>
        <a class="not-found__link" href="/">${msg('Return to Landing Page')}</a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-archetype-detail': VelgArchetypeDetail;
  }
}
