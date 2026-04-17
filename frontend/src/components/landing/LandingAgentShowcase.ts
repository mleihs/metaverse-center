/**
 * Landing Agent Showcase — "Intercepted Personnel Dossiers"
 *
 * Space opera showcase of real AI characters as marketing content.
 * "The World Is the Ad" — actual game agents with holographic foil,
 * rarity badges, and AI-generated personalities, spread across a
 * cosmic surveillance desk.
 *
 * Self-contained section: fetches its own data, manages its own animations,
 * renders nothing if no showcase agents are found.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { agentsApi } from '../../services/api/AgentsApiService.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { captureError } from '../../services/SentryService.js';
import type { Agent, AgentAptitude, AptitudeSet, Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import '../agents/AgentCard.js';

interface ShowcaseAgent {
  agent: Agent;
  aptitudes: AptitudeSet | null;
  simulation: Simulation;
}

/* Column stagger offsets (px) for "dossiers spread on desk" effect */
const COL_STAGGER = [0, 14, 6, 10, 3, 18];

@localized()
@customElement('velg-landing-agent-showcase')
export class VelgLandingAgentShowcase extends LitElement {
  static styles = css`
    /* ── Host ─────────────────────────────────── */

    :host {
      display: block;
      position: relative;
      overflow: hidden;

      /* Component-local amber tints for gradient stops */
      --_primary-1: color-mix(in srgb, var(--color-primary) 1%, transparent);
      --_primary-2: color-mix(in srgb, var(--color-primary) 2.5%, transparent);
      --_primary-3: color-mix(in srgb, var(--color-primary) 3.5%, transparent);
      --_primary-10: color-mix(in srgb, var(--color-primary) 10%, transparent);
      --_primary-22: color-mix(in srgb, var(--color-primary) 22%, transparent);
      --_primary-25: color-mix(in srgb, var(--color-primary) 25%, transparent);
      --_nebula-violet: color-mix(in srgb, var(--color-epoch-influence) 4%, transparent);
      --_nebula-cyan: color-mix(in srgb, var(--color-info) 3.5%, transparent);
    }

    /* ── Section: cosmic void + nebula tints ──── */

    .showcase {
      position: relative;
      padding: var(--space-16, 64px) 0 var(--space-20, 80px);
      background:
        radial-gradient(ellipse at 15% 50%, var(--_nebula-violet) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 30%, var(--_nebula-cyan) 0%, transparent 45%),
        radial-gradient(ellipse at 50% 90%, var(--_primary-2) 0%, transparent 40%),
        radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-surface-inverse) 1%, transparent) 0%, transparent 30%),
        var(--color-surface);
    }

    /* ── Scanner beam — surveillance sweep ────── */

    .showcase::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 30%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--_primary-1) 20%,
        var(--_primary-3) 50%,
        var(--_primary-1) 80%,
        transparent 100%
      );
      animation: scanner-sweep 8s ease-in-out infinite;
      pointer-events: none;
      z-index: 0;
    }

    @keyframes scanner-sweep {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(450%); }
    }

    /* ── Inner container ─────────────────────── */

    .showcase__inner {
      position: relative;
      z-index: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 var(--space-6, 24px);
    }

    /* ── Divider — data stream line ──────────── */

    .showcase__divider {
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--_primary-10) 20%,
        var(--_primary-22) 50%,
        var(--_primary-10) 80%,
        transparent 100%
      );
      max-width: 500px;
      margin: 0 auto var(--space-12, 48px);
    }

    /* ── Header ───────────────────────────────── */

    .showcase__header {
      text-align: center;
      margin-bottom: var(--space-10, 40px);
    }

    .showcase__label {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4, 16px);
      min-height: 1.4em;
      text-shadow: 0 0 30px var(--_primary-25);
    }

    .showcase__subtitle {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: clamp(0.75rem, 1.2vw, 0.875rem);
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
      margin: 0;
      line-height: 1.6;
    }

    /* ── Card grid ────────────────────────────── */

    .showcase__grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      justify-items: center;
      max-width: 900px;
      margin: 0 auto;
      gap: var(--space-10, 40px) var(--space-6, 24px);
      padding: var(--space-6, 24px) 0;
    }

    /* ── Card wrapper — spring entrance ──────── */

    .showcase__card {
      position: relative;
      opacity: 0;
      transform: translateY(40px) scale(0.95);
      transition:
        opacity 700ms cubic-bezier(0.34, 1.56, 0.64, 1),
        transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1);
      transition-delay: calc(var(--i, 0) * 120ms);
    }

    .showcase__card.in-view {
      opacity: 1;
      transform: translateY(var(--stagger, 0px)) scale(1);
    }

    .showcase__card:focus-within {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 8px;
      border-radius: 4px;
    }

    /* ── Origin label — sim attribution ──────── */

    .showcase__origin {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding-left: 4px;
      opacity: 0;
      transform: translateX(-12px);
      transition:
        opacity 400ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
      transition-delay: calc(var(--i, 0) * 120ms + 400ms);
    }

    .showcase__card.in-view .showcase__origin {
      opacity: 1;
      transform: translateX(0);
    }

    .showcase__origin-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--theme-color);
      box-shadow: 0 0 10px var(--theme-color);
      flex-shrink: 0;
    }

    .showcase__origin-name {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 190px;
    }

    /* ── Footer: tagline + CTA ────────────────── */

    .showcase__footer {
      text-align: center;
      margin-top: var(--space-12, 48px);
    }

    .showcase__tagline {
      font-family: var(--font-bureau, 'Spectral', Georgia, serif);
      font-style: italic;
      font-size: clamp(1rem, 2.2vw, 1.3rem);
      color: var(--color-text-secondary);
      line-height: 1.7;
      max-width: 600px;
      margin: 0 auto var(--space-6, 24px);
      min-height: 1.8em;
    }

    /* Blinking terminal cursor */

    .showcase__cursor {
      display: inline-block;
      width: 2px;
      height: 1.15em;
      background: var(--color-accent-amber);
      margin-left: 2px;
      vertical-align: text-bottom;
      animation: cursor-blink 800ms step-end infinite;
    }

    @keyframes cursor-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }

    .showcase__cta-wrap {
      margin-top: var(--space-6, 24px);
    }

    .showcase__cta {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 11px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      text-decoration: none;
      cursor: pointer;
      transition: color 200ms;
    }

    .showcase__cta:hover {
      color: var(--color-text-primary);
    }

    .showcase__cta:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 4px;
    }

    .showcase__cta-arrow {
      display: inline-block;
      transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .showcase__cta:hover .showcase__cta-arrow {
      transform: translateX(6px);
    }

    /* Amber underline expands on hover */

    .showcase__cta-underline {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 0;
      height: 1px;
      background: var(--color-accent-amber);
      transition: width 300ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .showcase__cta:hover .showcase__cta-underline {
      width: 100%;
    }

    /* ── Standard Desktop / 1080p (1280px+): 4 columns ─── */

    @media (min-width: 1280px) {
      .showcase__inner {
        max-width: 1400px;
      }

      .showcase__grid {
        grid-template-columns: repeat(4, 1fr);
        max-width: 1200px;
      }
    }

    /* ── Widescreen / 1440p (1600px+) ─────── */

    @media (min-width: 1600px) {
      .showcase__inner {
        max-width: 1500px;
      }

      .showcase__grid {
        max-width: 1400px;
      }
    }

    /* ── Ultrawide / 4K (2560px+) ──────── */

    @media (min-width: 2560px) {
      .showcase__inner {
        max-width: 2200px;
      }

      .showcase__grid {
        grid-template-columns: repeat(6, 1fr);
        max-width: 2200px;
      }
    }

    /* ── Mobile: horizontal snap-scroll ──────── */

    @media (max-width: 768px) {
      .showcase {
        padding: var(--space-12, 48px) 0 var(--space-16, 64px);
      }

      .showcase__grid {
        display: flex;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        gap: var(--space-4, 16px);
        padding: var(--space-4, 16px) var(--space-6, 24px);
        scrollbar-width: none;
      }

      .showcase__grid::-webkit-scrollbar {
        display: none;
      }

      /* Card sizing: min(260px, 72vw) fills most of the viewport while
         leaving a peek of the next card. min-width: 0 prevents flex items
         from expanding beyond flex-basis (shadow DOM content can force
         min-width: auto otherwise). Scroll-reveal animation is disabled
         because IntersectionObserver doesn't fire in overflow containers,
         leaving cards stuck at scale(0.95).
         .in-view variant must match desktop specificity (0,2,0) to
         override the stagger transform without !important. */
      .showcase__card,
      .showcase__card.in-view {
        flex: 0 0 min(260px, 72vw);
        min-width: 0;
        max-width: min(260px, 72vw);
        scroll-snap-align: center;
        opacity: 1;
        transform: none;
        transition: none;
      }

      .showcase__origin,
      .showcase__card.in-view .showcase__origin {
        opacity: 1;
        transform: none;
        transition: none;
      }
    }

    /* ── Reduced motion — respect the user ───── */

    @media (prefers-reduced-motion: reduce) {
      .showcase::after {
        animation: none;
        display: none;
      }

      .showcase__card {
        opacity: 1;
        transform: none !important;
        transition: none;
      }

      .showcase__origin {
        opacity: 1;
        transform: none;
        transition: none;
      }

      .showcase__cursor {
        animation: none;
        display: none;
      }
    }
  `;

  /* ── State ───────────────────────────────── */

  @state() private _agents: ShowcaseAgent[] = [];
  @state() private _loading = true;

  private _observer?: IntersectionObserver;
  private _sectionObserver?: IntersectionObserver;
  private _decodeInterval?: ReturnType<typeof setInterval>;
  private _typewriterTimeout?: ReturnType<typeof setTimeout>;
  private _decoded = false;
  private _typed = false;
  private _triggersSetup = false;

  /* ── Lifecycle ───────────────────────────── */

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetchShowcaseAgents();
  }

  protected updated(): void {
    if (this._agents.length === 0) return;
    this._setupScrollReveal();
    if (!this._triggersSetup) {
      this._triggersSetup = true;
      this._setupScrollTriggers();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._sectionObserver?.disconnect();
    if (this._decodeInterval) clearInterval(this._decodeInterval);
    if (this._typewriterTimeout) clearTimeout(this._typewriterTimeout);
    document.getElementById('velg-agents-structured-data')?.remove();
  }

  /* ── Responsive layout config ────────────── */

  private _getLayout(): { simLimit: number; perSim: number; maxTotal: number; cols: number } {
    const w = window.innerWidth;
    if (w >= 2560) return { simLimit: 8, perSim: 2, maxTotal: 12, cols: 6 };
    if (w >= 1440) return { simLimit: 8, perSim: 1, maxTotal: 8, cols: 4 };
    return { simLimit: 6, perSim: 1, maxTotal: 6, cols: 3 };
  }

  /* ── Data fetching ─────────────────────────── */

  private async _fetchShowcaseAgents(): Promise<void> {
    this._loading = true;
    const layout = this._getLayout();
    try {
      const simResp = await simulationsApi.listPublic({
        limit: String(layout.simLimit),
        offset: '0',
      });
      if (!simResp.success || !Array.isArray(simResp.data)) {
        this._loading = false;
        return;
      }

      const sims = simResp.data as Simulation[];
      const allShowcase: ShowcaseAgent[] = [];

      await Promise.all(
        sims.map(async (sim) => {
          // Landing page is a guest-visible community showcase; fetch via
          // public endpoints unconditionally so it works for signed-out users
          // and signed-in users browsing simulations they are not a member of.
          const [agentResp, aptResp] = await Promise.all([
            agentsApi.listPublic(sim.id, { limit: '6' }),
            agentsApi.getAllAptitudes(sim.id, 'public'),
          ]);

          if (!agentResp.success || !Array.isArray(agentResp.data)) return;

          const agents = agentResp.data as Agent[];
          const aptitudes =
            aptResp.success && Array.isArray(aptResp.data) ? (aptResp.data as AgentAptitude[]) : [];

          // Build aptitude sets per agent
          const aptMap = new Map<string, Record<string, number>>();
          for (const apt of aptitudes) {
            if (!aptMap.has(apt.agent_id)) aptMap.set(apt.agent_id, {});
            aptMap.get(apt.agent_id)![apt.operative_type] = apt.aptitude_level;
          }

          // Score: portrait (+3), ambassador (+2), character text (+1)
          const scored = agents.map((agent) => ({
            agent,
            aptitudes: (aptMap.get(agent.id) ?? null) as AptitudeSet | null,
            simulation: sim,
            score:
              (agent.portrait_image_url ? 3 : 0) +
              (agent.is_ambassador ? 2 : 0) +
              (t(agent, 'character') ? 1 : 0),
          }));

          scored.sort((a, b) => b.score - a.score);
          // Take top N per simulation (1 at default, 2 at ultrawide)
          for (const pick of scored.slice(0, layout.perSim)) {
            allShowcase.push({
              agent: pick.agent,
              aptitudes: pick.aptitudes,
              simulation: pick.simulation,
            });
          }
        }),
      );

      this._agents = allShowcase.slice(0, layout.maxTotal);
      this._injectStructuredData();
    } catch (err) {
      captureError(err, { source: 'VelgLandingAgentShowcase._fetchShowcaseAgents' });
    } finally {
      this._loading = false;
    }
  }

  /* ── Scroll triggers ─────────────────────── */

  private _setupScrollTriggers(): void {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._sectionObserver?.disconnect();
    this._sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          if (!this._decoded) {
            if (prefersReduced) {
              this._showLabelImmediate();
            } else {
              this._animateDecode();
            }
          }

          if (!this._typed) {
            if (prefersReduced) {
              this._showTaglineImmediate();
            } else {
              // Delay typewriter until cards have entered
              const delay = this._agents.length * 120 + 600;
              this._typewriterTimeout = setTimeout(() => this._animateTypewriter(), delay);
            }
          }

          this._sectionObserver?.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );

    const section = this.renderRoot.querySelector('.showcase');
    if (section) this._sectionObserver.observe(section);
  }

  private _setupScrollReveal(): void {
    this._observer?.disconnect();
    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            this._observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );

    const els = this.renderRoot.querySelectorAll('.scroll-reveal:not(.in-view)');
    for (const el of els) this._observer.observe(el);
  }

  /* ── Section label: scramble → decode ──────── */

  private _animateDecode(): void {
    this._decoded = true;
    const el = this.renderRoot.querySelector<HTMLElement>('.showcase__label-text');
    if (!el) return;

    const target = msg('Intercepted Dossiers').toUpperCase();
    const scrambleChars = '\u2588\u2593\u2591\u2592\u2580\u2584\u258C\u2590';
    const totalSteps = 25;
    let step = 0;

    this._decodeInterval = setInterval(() => {
      step++;
      const progress = step / totalSteps;
      const revealed = Math.floor(progress * target.length);

      let text = '';
      for (let i = 0; i < target.length; i++) {
        if (target[i] === ' ') {
          text += ' ';
        } else if (i < revealed) {
          text += target[i];
        } else {
          text += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        }
      }
      el.textContent = text;

      if (step >= totalSteps) {
        clearInterval(this._decodeInterval);
        el.textContent = target;
      }
    }, 50);
  }

  private _showLabelImmediate(): void {
    this._decoded = true;
    const el = this.renderRoot.querySelector<HTMLElement>('.showcase__label-text');
    if (el) el.textContent = msg('Intercepted Dossiers').toUpperCase();
  }

  /* ── Tagline: typewriter reveal ────────────── */

  private _animateTypewriter(): void {
    this._typed = true;
    const el = this.renderRoot.querySelector<HTMLElement>('.showcase__tagline-text');
    if (!el) return;

    const fullText = msg('These are real AI characters. They remember. They hold grudges.');
    let charIndex = 0;

    const type = () => {
      if (charIndex <= fullText.length) {
        el.textContent = fullText.slice(0, charIndex);
        charIndex++;
        this._typewriterTimeout = setTimeout(type, 35);
      }
    };

    type();
  }

  private _showTaglineImmediate(): void {
    this._typed = true;
    const el = this.renderRoot.querySelector<HTMLElement>('.showcase__tagline-text');
    if (el) {
      el.textContent = msg('These are real AI characters. They remember. They hold grudges.');
    }
  }

  /* ── SEO structured data ───────────────────── */

  private _injectStructuredData(): void {
    if (this._agents.length === 0) return;

    // Use dedicated ID to avoid overwriting landing page's structured data
    document.getElementById('velg-agents-structured-data')?.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'velg-agents-structured-data';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Featured AI Characters',
      numberOfItems: this._agents.length,
      itemListElement: this._agents.map((entry, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: entry.agent.name,
        description: t(entry.agent, 'character') || t(entry.agent, 'primary_profession') || '',
        ...(entry.agent.portrait_image_url ? { image: entry.agent.portrait_image_url } : {}),
      })),
    });
    document.head.appendChild(script);
  }

  /* ── Navigation ────────────────────────────── */

  private _handleAgentClick(entry: ShowcaseAgent): void {
    const slug = entry.simulation.slug || entry.simulation.id;
    navigate(`/simulations/${slug}/agents`);
  }

  /* ── Render ────────────────────────────────── */

  protected render() {
    if (this._loading || this._agents.length === 0) return nothing;

    const cols = this._getLayout().cols;

    return html`
      <section
        class="showcase"
        aria-label=${msg('Featured Characters')}
      >
        <div class="showcase__inner">
          <div class="showcase__divider" aria-hidden="true"></div>

          <div class="showcase__header">
            <p class="showcase__label" aria-hidden="true">
              <span class="showcase__label-text"></span>
            </p>
            <p class="showcase__subtitle">
              ${msg('Personnel files extracted from active simulation feeds')}
            </p>
          </div>

          <div class="showcase__grid" role="list">
            ${this._agents.map((entry, i) => {
              const stagger = COL_STAGGER[i % cols];
              const themeColor = getThemeColor(entry.simulation.theme ?? 'custom');

              return html`
                <div
                  class="showcase__card scroll-reveal"
                  style="--i: ${i}; --stagger: ${stagger}px; --theme-color: ${themeColor}"
                  role="listitem"
                >
                  <velg-agent-card
                    .agent=${entry.agent}
                    .aptitudes=${entry.aptitudes}
                    @agent-click=${() => this._handleAgentClick(entry)}
                  ></velg-agent-card>
                  <div class="showcase__origin">
                    <span class="showcase__origin-dot" aria-hidden="true"></span>
                    <span class="showcase__origin-name">${t(entry.simulation, 'name')}</span>
                  </div>
                </div>
              `;
            })}
          </div>

          <div class="showcase__footer">
            <p class="showcase__tagline">
              <span class="showcase__tagline-text"></span>
              <span class="showcase__cursor" aria-hidden="true"></span>
            </p>
            <div class="showcase__cta-wrap">
              <a
                class="showcase__cta"
                href="/worlds"
                @click=${(e: Event) => {
                  e.preventDefault();
                  navigate('/worlds');
                }}
              >
                ${msg('Meet more characters')}
                <span class="showcase__cta-arrow" aria-hidden="true">\u2192</span>
                <span class="showcase__cta-underline" aria-hidden="true"></span>
              </a>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-agent-showcase': VelgLandingAgentShowcase;
  }
}
