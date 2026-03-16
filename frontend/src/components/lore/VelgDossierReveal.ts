import { localized, msg } from '@lit/localize';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { dossierRevealStyles } from './dossier-reveal-styles.js';

type CeremonyPhase = 'stamp' | 'typewriter' | 'sections' | 'ready';

const SECTION_LABELS = [
  () => msg('ARCANUM ALPHA — Pre-Arrival History'),
  () => msg('ARCANUM BETA — Agent Classified Addenda'),
  () => msg('ARCANUM GAMMA — Geographic Anomalies'),
  () => msg('ARCANUM DELTA — Bleed Signature Analysis'),
  () => msg('ARCANUM EPSILON — Prophetic Fragments'),
  () => msg('ARCANUM ZETA — Bureau Recommendation'),
];

/**
 * Full-screen theatrical reveal ceremony when a classified dossier is unlocked.
 * 4-phase animation: stamp → typewriter → section reveal → BEGIN READING.
 * Respects prefers-reduced-motion. Focus-trapped. Escape dismisses.
 */
@localized()
@customElement('velg-dossier-reveal')
export class VelgDossierReveal extends LitElement {
  static styles = [dossierRevealStyles];

  @property({ type: String }) simulationName = '';

  @state() private _phase: CeremonyPhase = 'stamp';
  @state() private _typewriterText = '';
  @state() private _sectionsRevealed = 0;

  private _typewriterTimer?: ReturnType<typeof setInterval>;
  private _sectionTimer?: ReturnType<typeof setInterval>;
  private _phaseTimers: ReturnType<typeof setTimeout>[] = [];
  private _btnRef?: HTMLButtonElement;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._handleKeydown);

    // Check reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      this._phase = 'ready';
      this._typewriterText = this._getFullTypewriterText();
      this._sectionsRevealed = 6;
      return;
    }

    this._startCeremony();
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this._handleKeydown);
    this._cleanup();
    super.disconnectedCallback();
  }

  private _handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this._complete();
    }
  };

  private _getFullTypewriterText(): string {
    return `${msg('CLASSIFIED DOSSIER')} // ${this.simulationName.toUpperCase()} // ${msg('AUTHORIZATION CONFIRMED')}`;
  }

  private _startCeremony(): void {
    // Phase 1 → 2: Stamp → Typewriter (after 1.2s)
    this._phaseTimers.push(
      setTimeout(() => {
        this._phase = 'typewriter';
        this._startTypewriter();
      }, 1200),
    );
  }

  private _startTypewriter(): void {
    const fullText = this._getFullTypewriterText();
    let charIndex = 0;

    this._typewriterTimer = setInterval(() => {
      charIndex++;
      this._typewriterText = fullText.slice(0, charIndex);

      if (charIndex >= fullText.length) {
        clearInterval(this._typewriterTimer);
        // Phase 2 → 3: Typewriter → Sections (after 500ms pause)
        this._phaseTimers.push(
          setTimeout(() => {
            this._phase = 'sections';
            this._startSectionReveal();
          }, 500),
        );
      }
    }, 40);
  }

  private _startSectionReveal(): void {
    this._sectionTimer = setInterval(() => {
      this._sectionsRevealed++;
      if (this._sectionsRevealed >= 6) {
        clearInterval(this._sectionTimer);
        // Phase 3 → 4: Sections → Ready (after 600ms)
        this._phaseTimers.push(
          setTimeout(() => {
            this._phase = 'ready';
            // Focus the button after render
            this.updateComplete.then(() => {
              this._btnRef =
                this.shadowRoot?.querySelector<HTMLButtonElement>('.action__btn') ?? undefined;
              this._btnRef?.focus();
            });
          }, 600),
        );
      }
    }, 400);
  }

  private _cleanup(): void {
    if (this._typewriterTimer) clearInterval(this._typewriterTimer);
    if (this._sectionTimer) clearInterval(this._sectionTimer);
    for (const t of this._phaseTimers) clearTimeout(t);
    this._phaseTimers = [];
  }

  private _complete(): void {
    this._cleanup();
    this.dispatchEvent(
      new CustomEvent('dossier-ceremony-complete', { bubbles: true, composed: true }),
    );
  }

  protected render() {
    return html`
      <div
        class="reveal"
        role="dialog"
        aria-modal="true"
        aria-label=${msg('Classified dossier unlocked')}
      >
        <div class="reveal__backdrop"></div>
        <div class="reveal__content">
          ${this._renderStamp()}
          ${this._phase !== 'stamp' ? this._renderTypewriter() : nothing}
          ${
            this._phase === 'sections' || this._phase === 'ready' ? this._renderSections() : nothing
          }
          ${this._phase === 'ready' ? this._renderAction() : nothing}
        </div>
        <div class="stamp__flash"></div>
      </div>
    `;
  }

  private _renderStamp() {
    return html`
      <div class="stamp">
        <div class="stamp__title">
          ${msg('BUREAU OF IMPOSSIBLE GEOGRAPHY')}
        </div>
        <div class="stamp__subtitle">
          ${msg('CLASSIFICATION OVERRIDE')}
        </div>
      </div>
    `;
  }

  private _renderTypewriter() {
    return html`
      <div class="typewriter" aria-live="assertive">
        <span class="typewriter__text">${this._typewriterText}</span>
        ${
          this._phase === 'typewriter'
            ? html`<span class="typewriter__cursor" aria-hidden="true"></span>`
            : nothing
        }
      </div>
    `;
  }

  private _renderSections() {
    return html`
      <div class="sections">
        ${SECTION_LABELS.map((labelFn, i) => {
          const revealed = i < this._sectionsRevealed;
          if (!revealed && this._phase !== 'ready') return nothing;

          return html`
            <div
              class="section-slot"
              style="animation-delay: ${i * 400}ms"
            >
              <span class="section-slot__label">${labelFn()}</span>
              ${
                revealed
                  ? html`<span
                    class="section-slot__stamp"
                    style="animation-delay: ${i * 400 + 200}ms"
                  >${msg('DECLASSIFIED')}</span>`
                  : nothing
              }
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderAction() {
    return html`
      <div class="action">
        <button class="action__btn" @click=${this._complete}>
          ${msg('BEGIN READING')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dossier-reveal': VelgDossierReveal;
  }
}
