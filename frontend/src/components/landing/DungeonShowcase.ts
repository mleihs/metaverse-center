/**
 * Dungeon Archetype Showcase — Fullscreen immersive slider.
 *
 * Behavior only. Data in dungeon-showcase-data.ts, styles composed from
 * dungeon-showcase-styles.ts (layout, atmospheres, transitions).
 *
 * Pacing: quote-driven. Shows QUOTES_PER_SLIDE quotes per slide, then
 * auto-advances. Quotes with non-English originals show the translation
 * first, then reveal the original language with a cross-fade.
 *
 * Animation timing: CSS animations are the single source of truth.
 * The JS never guesses durations — it listens for `animationend` events.
 * Display durations (how long to show text) are JS-owned constants.
 *
 * Timer safety:
 *   - Generation counter (`_gen`) invalidates all pending callbacks on nav.
 *   - `_after()` manages display-duration timers; `_awaitAnimation()` manages
 *     CSS animation completion. Both are cancelled via `_cancelAll()`.
 *   - IntersectionObserver starts/stops timers based on viewport visibility.
 *
 * Accessibility:
 *   - role="region" + aria-roledescription="carousel"
 *   - role="tabpanel" per slide, role="tab" per dot (linked via aria-controls)
 *   - aria-live="polite" + aria-atomic on quote block
 *   - lang attribute on original-language text (screen reader voice switch)
 *   - tabindex="0" on host for keyboard focus
 *   - prefers-reduced-motion disables all animations
 *   - 44px min touch targets on mobile
 */

import { localized, msg } from '@lit/localize';
import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { ARCHETYPES, type ArchetypeQuote } from './dungeon-showcase-data.js';
import {
  showcaseAtmosphereStyles,
  showcaseLayoutStyles,
  showcaseTransitionStyles,
} from './dungeon-showcase-styles.js';

// ── Timing ──────────────────────────────────────────────────────────────────
// Display durations are JS-owned (how long to show content).
// Animation durations are CSS-owned (JS listens for `animationend`).

const QUOTES_PER_SLIDE = 2;
/** Time the English translation is shown before cross-fading to original. */
const TRANSLATION_MS = 4_500;
/** Time the original-language text is shown before leaving. */
const ORIGINAL_MS = 5_500;
/** Time a quote without original stays visible. */
const SINGLE_VISIBLE_MS = 9_000;
/** Duration of the translation↔original cross-fade (CSS transition, not animation). */
const SWAP_MS = 900;
/** Rest after the last quote before slide advances. */
const REST_MS = 2_000;
/** Must match CSS `.slide` opacity transition (0.8s). */
const SLIDE_TRANSITION_MS = 800;
/** Delay before first quote after slide change — lets the slide
 *  reach ~70 % opacity so the quote enters on a stable background. */
const SLIDE_SETTLE_MS = 500;
/** Safety cap for animationend — if the event never fires (e.g. a browser
 *  quirk or a CSS change that removes the animation), don't hang forever. */
const ANIM_FALLBACK_MS = 2_500;

/** BCP-47 codes for the lang attribute on original text. */
const LANG_CODES: Record<string, string> = {
  Deutsch: 'de',
  'Fran\u00e7ais': 'fr',
  Polski: 'pl',
  Italiano: 'it',
  'Espa\u00f1ol': 'es',
  '\u0420\u0443\u0441\u0441\u043a\u0438\u0439': 'ru',
};

type QuotePhase = 'entering' | 'visible' | 'swapping' | 'original' | 'leaving';

// ── Component ───────────────────────────────────────────────────────────────

@localized()
@customElement('velg-dungeon-showcase')
export class VelgDungeonShowcase extends LitElement {
  static styles = [showcaseLayoutStyles, showcaseAtmosphereStyles, showcaseTransitionStyles];

  @state() private _activeIndex = 0;
  @state() private _quoteIndex = 0;
  @state() private _phase: QuotePhase = 'entering';

  private _gen = 0;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _quotesShown = 0;
  private _navGuardTimer: ReturnType<typeof setTimeout> | null = null;
  private _navLocked = false;
  private _observer: IntersectionObserver | null = null;
  private _visible = false;
  private _touchStartX = 0;
  private _touchStartY = 0;
  private _animCleanup: (() => void) | null = null;
  private _paused = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('tabindex', '0');
    this.addEventListener('keydown', this._onKeydown);
    this.addEventListener('mouseenter', this._onHoverPause);
    this.addEventListener('mouseleave', this._onHoverResume);
    this.addEventListener('focusin', this._onHoverPause);
    this.addEventListener('focusout', this._onHoverResume);
    this._setupVisibilityObserver();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._cancelAll();
    this._observer?.disconnect();
    this._observer = null;
    this.removeEventListener('keydown', this._onKeydown);
    this.removeEventListener('mouseenter', this._onHoverPause);
    this.removeEventListener('mouseleave', this._onHoverResume);
    this.removeEventListener('focusin', this._onHoverPause);
    this.removeEventListener('focusout', this._onHoverResume);
  }

  // ── Visibility (IntersectionObserver) ─────────────────────────────────────

  private _setupVisibilityObserver(): void {
    this._observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = this._visible;
        this._visible = entry.isIntersecting;
        if (this._visible && !wasVisible) {
          // Entered viewport — wait for fonts, then start.
          // Prevents FOUT layout shifts during quote animations.
          this._gen++;
          const gen = this._gen;
          document.fonts.ready.then(() => {
            if (gen !== this._gen) return;
            this._beginSlide();
          });
        } else if (!this._visible && wasVisible) {
          // Left viewport — stop timers, save resources.
          this._gen++;
          this._cancelAll();
        }
      },
      { threshold: 0.3 },
    );
    this._observer.observe(this);
  }

  // ── Hover/Focus pause (WCAG 2.2.2: Pause, Stop, Hide) ────────────────────

  private _onHoverPause = (): void => {
    if (this._paused) return;
    this._paused = true;
    this._cancelTimer();
  };

  private _onHoverResume = (): void => {
    if (!this._paused || !this._visible) return;
    // Defer: focusout fires before focusin on internal focus moves.
    // Check on next microtask whether focus actually left the carousel.
    requestAnimationFrame(() => {
      if (this.matches(':hover') || this.contains(document.activeElement)) return;
      this._paused = false;
      this._beginSlide();
    });
  };

  // ── Timer (generation-guarded) ────────────────────────────────────────────

  /** Schedule a callback after `ms` milliseconds. Only one timer at a time;
   *  calling `_after()` again cancels the previous one. Generation-guarded.
   *  No-op while paused (hover/focus). */
  private _after(ms: number, fn: () => void): void {
    if (this._paused) return;
    this._cancelTimer();
    const gen = this._gen;
    this._timer = setTimeout(() => {
      if (gen !== this._gen) return;
      fn();
    }, ms);
  }

  private _cancelTimer(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** Wait for the CSS animation on `.quote-block` to finish, then call `fn`.
   *  Waits for Lit render + one frame so the browser has started the animation.
   *  Falls back to a timeout if no animation fires (reduced-motion, missing
   *  animation, browser quirk). Generation-guarded + cleanup on cancel. */
  private _awaitAnimation(fn: () => void): void {
    this._cancelAnimCleanup();
    const gen = this._gen;

    this.updateComplete.then(() => {
      if (gen !== this._gen) return;

      // One frame for the browser to start the animation after DOM update.
      requestAnimationFrame(() => {
        if (gen !== this._gen) return;

        const el = this.renderRoot.querySelector('.quote-block');
        if (!el) {
          fn();
          return;
        }

        let resolved = false;
        const resolve = () => {
          if (resolved) return;
          resolved = true;
          el.removeEventListener('animationend', resolve);
          clearTimeout(fallback);
          this._animCleanup = null;
          if (gen !== this._gen) return;
          fn();
        };

        el.addEventListener('animationend', resolve, { once: true });
        const fallback = setTimeout(resolve, ANIM_FALLBACK_MS);

        this._animCleanup = () => {
          el.removeEventListener('animationend', resolve);
          clearTimeout(fallback);
          resolved = true;
        };
      });
    });
  }

  private _cancelAnimCleanup(): void {
    this._animCleanup?.();
    this._animCleanup = null;
  }

  private _cancelAll(): void {
    this._cancelTimer();
    this._cancelAnimCleanup();
    if (this._navGuardTimer !== null) {
      clearTimeout(this._navGuardTimer);
      this._navGuardTimer = null;
    }
    this._navLocked = false;
  }

  // ── Quote-driven pacing ───────────────────────────────────────────────────

  private get _quote(): ArchetypeQuote {
    return ARCHETYPES[this._activeIndex].quotes[this._quoteIndex];
  }

  private get _hasOriginal(): boolean {
    return !!this._quote.original;
  }

  private _beginSlide(): void {
    this._quoteIndex = 0;
    this._quotesShown = 0;
    this._enterQuote();
  }

  private _enterQuote(): void {
    this._phase = 'entering';
    // CSS animation drives the enter. When it completes → visible phase.
    this._awaitAnimation(() => {
      this._phase = 'visible';
      if (this._hasOriginal) {
        this._after(TRANSLATION_MS, () => this._swapToOriginal());
      } else {
        this._after(SINGLE_VISIBLE_MS, () => this._leaveQuote());
      }
    });
  }

  private _swapToOriginal(): void {
    this._phase = 'swapping';
    // Swap is a CSS transition (opacity/filter), not a CSS animation.
    // Timer-driven because transitions don't have distinct `animationend`.
    this._after(SWAP_MS, () => {
      this._phase = 'original';
      this._after(ORIGINAL_MS, () => this._leaveQuote());
    });
  }

  private _leaveQuote(): void {
    this._quotesShown++;
    this._phase = 'leaving';

    if (this._quotesShown >= QUOTES_PER_SLIDE) {
      // CSS leave animation plays, then rest, then advance.
      this._awaitAnimation(() => {
        this._after(REST_MS, () => this._advanceSlide());
      });
    } else {
      // CSS leave animation plays, then swap in the next quote.
      this._awaitAnimation(async () => {
        const gen = this._gen;
        const maxQ = ARCHETYPES[this._activeIndex].quotes.length;
        this._quoteIndex = (this._quoteIndex + 1) % maxQ;
        // Lit re-renders with new quote content at opacity 0 (base state).
        // Wait for the DOM update before starting the enter animation.
        await this.updateComplete;
        if (gen !== this._gen) return;
        this._enterQuote();
      });
    }
  }

  private _advanceSlide(): void {
    this._navigateTo((this._activeIndex + 1) % ARCHETYPES.length);
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  private _navigateTo(index: number): void {
    if (index === this._activeIndex || this._navLocked) return;
    this._gen++;
    this._cancelAll();
    this._navLocked = true;
    this._activeIndex = index;
    // Let the slide cross-fade settle before overlaying the first quote.
    // Without this, the quote enter animation races the slide fade-in
    // and the user never sees the quote arrive on a stable background.
    this._after(SLIDE_SETTLE_MS, () => this._beginSlide());
    this._navGuardTimer = setTimeout(() => {
      this._navLocked = false;
      this._navGuardTimer = null;
    }, SLIDE_TRANSITION_MS);
  }

  private _goNext = (): void => {
    this._navigateTo((this._activeIndex + 1) % ARCHETYPES.length);
  };

  private _goPrev = (): void => {
    this._navigateTo((this._activeIndex - 1 + ARCHETYPES.length) % ARCHETYPES.length);
  };

  // ── Event handlers ────────────────────────────────────────────────────────

  private _onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this._goNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this._goPrev();
    }
  };

  private _onDotClick(index: number): void {
    this._navigateTo(index);
  }

  /** SPA navigation — crawlable `<a href>` with client-side routing. */
  private _onCtaNavigate(e: Event, id: string): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', {
        bubbles: true,
        composed: true,
        detail: `/archetypes/${id}`,
      }),
    );
  }

  /** Localized CTA labels. Each call to msg() is a distinct extraction point.
   *  Voice matches the literary tradition of each archetype. */
  private _ctaLabel(id: string): string {
    switch (id) {
      case 'shadow':
        return msg('Descend');
      case 'tower':
        return msg('Face the Trial');
      case 'mother':
        return msg('Accept the Gift');
      case 'entropy':
        return msg('Carry On');
      case 'prometheus':
        return msg('Steal the Flame');
      case 'deluge':
        return msg('Go Under');
      case 'awakening':
        return msg('Open Your Eyes');
      case 'overthrow':
        return msg('Seize Power');
      default:
        return msg('Explore');
    }
  }

  private _onTouchStart = (e: TouchEvent): void => {
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  };

  private _onTouchEnd = (e: TouchEvent): void => {
    const dx = e.changedTouches[0].clientX - this._touchStartX;
    const dy = e.changedTouches[0].clientY - this._touchStartY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) this._goNext();
      else this._goPrev();
    }
  };

  // ── Template ──────────────────────────────────────────────────────────────

  private _renderQuote(quote: ArchetypeQuote, phase: QuotePhase): TemplateResult {
    const showOriginal = phase === 'swapping' || phase === 'original';
    const langCode = quote.originalLang ? LANG_CODES[quote.originalLang] : undefined;

    return html`
      <div
        class=${classMap({
          'quote-block': true,
          [phase]: true,
          'show-original': showOriginal,
        })}
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="quote-block__text-wrap">
          <p class="quote-block__text">${quote.text}</p>
          ${
            quote.original
              ? html`<p class="quote-block__original" lang=${langCode ?? nothing}>${quote.original}</p>`
              : nothing
          }
        </div>
        ${
          quote.originalLang
            ? html`<span class="quote-block__lang" aria-hidden="true">${quote.originalLang}</span>`
            : nothing
        }
        <cite class="quote-block__author">${quote.author}</cite>
      </div>
    `;
  }

  protected render(): TemplateResult {
    const arch = ARCHETYPES[this._activeIndex];

    return html`
      <div
        class="showcase"
        style="--_accent: ${arch.accent};"
        role="region"
        aria-roledescription="${msg('carousel')}"
        aria-label="${msg('Resonance Dungeon Archetypes')}"
        @touchstart=${this._onTouchStart}
        @touchend=${this._onTouchEnd}
      >
        <div class="classification" aria-hidden="true">
          ${msg('Resonance Dungeons')} \u2014 ${msg('Archetype Registry')}
        </div>

        ${ARCHETYPES.map(
          (a, i) => html`
            <div
              class=${classMap({ slide: true, active: i === this._activeIndex, [a.cssClass]: true })}
              role="tabpanel"
              id=${`showcase-panel-${i}`}
              aria-hidden=${i !== this._activeIndex}
              aria-labelledby=${`showcase-tab-${i}`}
              style="--_accent: ${a.accent}; --_bg-image: url(${a.imageUrl}); --_scrim-blur: ${a.scrim[0]}px; --_scrim-brightness: ${a.scrim[1]}; --_scrim-saturate: ${a.scrim[2]};"
            >
              <div class="slide__atmosphere"></div>
              <div class="slide__vignette"></div>
              <div class="slide__content">
                <span class="slide__numeral">
                  ${msg('Archetype')} ${a.numeral} / VIII
                </span>
                <h2 class="slide__title">${a.name}</h2>
                <p class="slide__subtitle">${a.subtitle}</p>
                <div class="slide__divider"></div>
                <p class="slide__tagline">${a.tagline}</p>
                <a
                  class="slide__cta"
                  href=${`/archetypes/${a.id}`}
                  @click=${(e: Event) => this._onCtaNavigate(e, a.id)}
                ><span class="slide__cta-text">${this._ctaLabel(a.id)}</span><span class="slide__cta-arrow" aria-hidden="true">\u25B8</span></a>
                ${i === this._activeIndex ? this._renderQuote(this._quote, this._phase) : nothing}
              </div>
            </div>
          `,
        )}

        <button class="nav-arrow nav-arrow--prev" @click=${this._goPrev}
          aria-label=${msg('Previous archetype')}>\u2190</button>
        <button class="nav-arrow nav-arrow--next" @click=${this._goNext}
          aria-label=${msg('Next archetype')}>\u2192</button>

        <nav class="nav-dots" role="tablist" aria-label=${msg('Archetype slides')}>
          ${ARCHETYPES.map(
            (a, i) => html`
              <button
                class=${classMap({ 'nav-dot': true, active: i === this._activeIndex })}
                role="tab"
                id=${`showcase-tab-${i}`}
                aria-selected=${i === this._activeIndex}
                aria-controls=${`showcase-panel-${i}`}
                aria-label=${a.name}
                @click=${() => this._onDotClick(i)}
              ></button>
            `,
          )}
        </nav>

        <div class="counter" aria-hidden="true">
          ${String(this._activeIndex + 1).padStart(2, '0')} / ${String(ARCHETYPES.length).padStart(2, '0')}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-showcase': VelgDungeonShowcase;
  }
}
