/**
 * How to Play — Quick Start (5-minute orientation).
 *
 * Vertical timeline with 5 steps. "Field Briefing" aesthetic:
 * authoritative but welcoming, like a military onboarding document
 * written by someone who actually cares if you succeed.
 *
 * Design contrast to Landing page (cards = choice):
 * Timeline = progression ("follow these steps, in this order").
 *
 * Typography: --font-brutalist (Courier/Monaco) for structure,
 * --font-prose (Spectral serif) for warmth.
 *
 * Research basis: Dwarf Fortress ("minimal critical information only"),
 * EVE Online ("never overwhelm"), Cognitive Load Theory (Level 1 = THAT
 * something exists + WHERE to find it, never HOW it works).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';
import {
  htpBackStyles,
  htpFooterNavStyles,
  htpHeroStyles,
  htpReducedMotionBase,
} from './htp-shared-styles.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface QuickStep {
  number: string;
  title: string;
  body: string;
  action?: { label: string; href: string };
  items?: string[];
}

// ── Component ────────────────────────────────────────────────────────────────

@localized()
@customElement('velg-how-to-play-quickstart')
export class VelgHowToPlayQuickstart extends LitElement {
  // ── Styles ───────────────────────────────────────────────────────────────

  static styles = [
    htpHeroStyles,
    htpBackStyles,
    htpFooterNavStyles,
    htpReducedMotionBase,
    css`
    /* ═══ HOST ═══════════════════════════════════════════════════════════ */

    :host {
      display: block;
      color: var(--color-text-primary);
      background: var(--color-surface);
      min-height: 100vh;
    }

    /* ═══ LAYOUT ════════════════════════════════════════════════════════ */

    .quickstart {
      max-width: 700px;
      margin: 0 auto;
      padding: var(--space-8) var(--content-padding) var(--space-16);
    }

    /* ═══ HERO OVERRIDES ═══════════════════════════════════════════════ */

    .hero {
      --_hero-title-margin: var(--space-3);
    }

    /* ═══ TIMELINE ══════════════════════════════════════════════════════ */

    .timeline {
      position: relative;
      padding-left: 56px;
      margin-bottom: var(--space-12);
    }

    /* The vertical connecting line */
    .timeline::before {
      content: '';
      position: absolute;
      left: 19px; /* center of 40px marker */
      top: 20px; /* center of first marker */
      bottom: 20px;
      width: 2px;
      background: color-mix(in srgb, var(--color-primary) 25%, transparent);

      /* Line draws itself in */
      transform-origin: top;
      animation: line-draw var(--duration-slow) var(--ease-dramatic) forwards;
      animation-delay: 100ms;
      transform: scaleY(0);
    }

    @keyframes line-draw {
      to { transform: scaleY(1); }
    }

    /* ═══ STEP ══════════════════════════════════════════════════════════ */

    .step {
      position: relative;
      padding-bottom: var(--space-10);

      /* Staggered entrance */
      opacity: 0;
      transform: translateX(-12px);
      animation: step-enter var(--duration-entrance) var(--ease-dramatic) forwards;
    }

    .step:last-child {
      padding-bottom: 0;
    }

    .step:nth-child(1) { animation-delay: 0ms; }
    .step:nth-child(2) { animation-delay: 100ms; }
    .step:nth-child(3) { animation-delay: 200ms; }
    .step:nth-child(4) { animation-delay: 300ms; }
    .step:nth-child(5) { animation-delay: 400ms; }

    @keyframes step-enter {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* ── Step Marker (numbered circle) ── */

    .step__marker {
      position: absolute;
      left: -56px;
      top: 0;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: var(--border-width-thick) solid var(--color-primary);
      background: var(--color-surface);
      z-index: 1;
    }

    .step__number {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      color: var(--color-primary);
      letter-spacing: 0.05em;
    }

    /* ── Step Content ── */

    .step__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-3);
      /* Align baseline with marker center */
      line-height: 40px;
      min-height: 40px;
    }

    .step__body {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-4);
      max-width: 56ch;
    }

    .step__action {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--color-primary);
      cursor: pointer;
      transition: gap var(--duration-fast) var(--ease-default);
    }

    .step__action:hover,
    .step__action:focus-visible {
      gap: var(--space-3);
    }

    /* ── Step 5: Action List ── */

    .step__items {
      list-style: none;
      padding: 0;
      margin: 0 0 var(--space-4);
      counter-reset: move;
    }

    .step__item {
      counter-increment: move;
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      padding: var(--space-2) 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    .step__item:last-child {
      border-bottom: none;
    }

    .step__item::before {
      content: counter(move);
      flex-shrink: 0;
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      color: var(--color-primary);
      width: 20px;
      text-align: right;
    }

    /* ═══ FOOTER NAV OVERRIDES ═════════════════════════════════════════ */

    .footer-nav {
      /* Entrance after steps */
      opacity: 0;
      animation: step-enter var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: 600ms;
    }

    /* ═══ REDUCED MOTION (component-specific) ═════════════════════════ */
    /* Back/footer-nav transforms handled by htpReducedMotionBase */

    @media (prefers-reduced-motion: reduce) {
      .step,
      .footer-nav,
      .timeline::before {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .step__action:hover,
      .step__action:focus-visible {
        gap: var(--space-2);
      }
    }

    /* ═══ RESPONSIVE: MOBILE (<768px) ═════════════════════════════════ */

    @media (max-width: 767px) {
      .quickstart {
        padding: var(--space-6) var(--space-4) var(--space-12);
      }

      .timeline {
        padding-left: 48px;
      }

      .timeline::before {
        left: 15px;
      }

      .step__marker {
        left: -48px;
        width: 32px;
        height: 32px;
      }

      .step__title {
        line-height: 32px;
        min-height: 32px;
        font-size: var(--text-lg);
      }

      .step__number {
        font-size: var(--text-xs);
      }
    }
  `,
  ];

  // ── Lifecycle ──────────────────────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([msg('Quick Start'), msg('How to Play')]);
    seoService.setDescription(
      msg(
        'Get started with metaverse.center in 5 minutes. Create AI-driven worlds, chat with agents, and compete in epochs.',
      ),
    );
    seoService.setCanonical('/how-to-play/quickstart');
    seoService.setBreadcrumbs([
      { name: msg('Home'), url: 'https://metaverse.center/' },
      { name: msg('How to Play'), url: 'https://metaverse.center/how-to-play' },
      { name: msg('Quick Start'), url: 'https://metaverse.center/how-to-play/quickstart' },
    ]);
    analyticsService.trackPageView('/how-to-play/quickstart', document.title);
  }

  // ── Data ───────────────────────────────────────────────────────────────

  private get _steps(): QuickStep[] {
    return [
      {
        number: '01',
        title: msg('This is metaverse.center'),
        body: msg(
          'AI-driven simulations \u2013 fictional worlds where agents have personalities, memories, and opinions. Everything is generated: dialogue, newspapers, weather reports, even the lore. Each world is alive.',
        ),
        action: { label: msg('Browse a simulation'), href: '/' },
      },
      {
        number: '02',
        title: msg('Create your world'),
        body: msg(
          'The Simulation Forge turns a single seed idea into a complete world \u2013 geography, agents, buildings, lore, and a visual identity \u2013 in about 15 minutes. No coding, no setup.',
        ),
        action: { label: msg('Open the Forge'), href: '/forge' },
      },
      {
        number: '03',
        title: msg('Talk to anyone'),
        body: msg(
          'Every agent remembers your conversations. They reference past events, form opinions about you, and develop richer personalities over time. Chat is persistent across sessions.',
        ),
      },
      {
        number: '04',
        title: msg('Compete in Epochs'),
        body: msg(
          'Epochs are time-limited PvP seasons scored across five dimensions. Deploy operatives, forge alliances, sabotage rivals. Your original world is never modified \u2013 gameplay happens on a balanced clone.',
        ),
        action: { label: msg('Learn about Epochs'), href: '/how-to-play/guide/epochs' },
      },
      {
        number: '05',
        title: msg('Your first moves'),
        body: msg('Five things you can do right now:'),
        items: [
          msg('Browse any simulation \u2013 no login required'),
          msg('Read the lore \u2013 every world has a unique story'),
          msg('Chat with an agent \u2013 they will remember you'),
          msg('Create your own world with the Forge'),
          msg('Join an Epoch when you are ready to compete'),
        ],
        action: { label: msg('Browse the Game Guide'), href: '/how-to-play/guide' },
      },
    ];
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  private _navigate(path: string) {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: path,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleLinkClick(e: Event, href: string) {
    e.preventDefault();
    this._navigate(href);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  protected render() {
    return html`
      <div class="quickstart">
        ${this._renderBack()}
        ${this._renderHero()}
        ${this._renderTimeline()}
        ${this._renderFooterNav()}
      </div>
    `;
  }

  private _renderBack() {
    return html`
      <a
        class="back"
        href="/how-to-play"
        @click=${(e: Event) => this._handleLinkClick(e, '/how-to-play')}
      >
        <span class="back__arrow" aria-hidden="true">\u25C2</span>
        ${msg('How to Play')}
      </a>
    `;
  }

  private _renderHero() {
    return html`
      <header class="hero">
        <span class="hero__eyebrow">${msg('Orientation Briefing')}</span>
        <h1 class="hero__title">${msg('Quick Start')}</h1>
        <p class="hero__subtitle">
          ${msg('Everything you need to know in 5 minutes.')}
        </p>
      </header>
    `;
  }

  private _renderTimeline() {
    return html`
      <div class="timeline" role="list" aria-label=${msg('Quick start steps')}>
        ${this._steps.map((step) => this._renderStep(step))}
      </div>
    `;
  }

  private _renderStep(step: QuickStep) {
    return html`
      <div class="step" role="listitem">
        <div class="step__marker">
          <span class="step__number">${step.number}</span>
        </div>
        <h2 class="step__title">${step.title}</h2>
        <p class="step__body">${step.body}</p>
        ${
          step.items
            ? html`
          <ol class="step__items">
            ${step.items.map((item) => html`<li class="step__item">${item}</li>`)}
          </ol>
        `
            : nothing
        }
        ${
          step.action
            ? html`
          <a
            class="step__action"
            href=${step.action.href}
            @click=${(e: Event) => this._handleLinkClick(e, step.action!.href)}
          >
            ${step.action.label}
            <span aria-hidden="true">\u25B8</span>
          </a>
        `
            : nothing
        }
      </div>
    `;
  }

  private _renderFooterNav() {
    return html`
      <nav class="footer-nav" aria-label=${msg('Next section')}>
        <a
          class="footer-nav__link"
          href="/how-to-play/guide"
          @click=${(e: Event) => this._handleLinkClick(e, '/how-to-play/guide')}
        >
          ${msg('Ready for more? Browse the Game Guide')}
          <span class="footer-nav__arrow" aria-hidden="true">\u25B8</span>
        </a>
      </nav>
    `;
  }
}

// ── Global Registration ──────────────────────────────────────────────────────

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play-quickstart': VelgHowToPlayQuickstart;
  }
}
