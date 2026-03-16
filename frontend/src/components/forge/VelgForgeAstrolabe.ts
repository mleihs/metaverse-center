import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { PhilosophicalAnchor } from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { t } from '../../utils/locale-fields.js';
import {
  forgeButtonStyles,
  forgeFieldStyles,
  forgeInfoBubbleStyles,
  forgeRangeStyles,
  forgeStatusStyles,
} from './forge-console-styles.js';
import { fanRotation, renderInfoBubble } from './forge-utils.js';

import './VelgForgeScanOverlay.js';

const SEED_SUGGESTIONS = [
  'A floating archipelago where memories solidify into islands and forgetting causes erosion. Cartographers wage silent wars over which memories are worth preserving.',
  'A city that only exists during solar eclipses — its inhabitants live compressed lifetimes in minutes of darkness. Between eclipses, they are nothing but equations scratched into observatory walls.',
  'An underground network of libraries where books rewrite themselves based on who reads them. The librarians have stopped reading entirely, terrified of what the books might become.',
  'A prison colony on a dying star where inmates mine crystallized light to fuel distant civilizations. The warden believes rehabilitation means learning to love the dark.',
];

/**
 * Phase I: The Astrolabe.
 * Research and Conceptualization UI with VelgGameCard fan anchors.
 */
@localized()
@customElement('velg-forge-astrolabe')
export class VelgForgeAstrolabe extends LitElement {
  static styles = [
    forgeButtonStyles,
    forgeFieldStyles,
    forgeRangeStyles,
    forgeStatusStyles,
    forgeInfoBubbleStyles,
    css`
      :host {
        display: block;
      }

      .astrolabe {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      /* ── Seed Box ────────────────────────── */

      .seed-box {
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-gray-700, #374151);
        padding: var(--space-6);
      }

      .seed-box__header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
      }

      .seed-box__title {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-success, #22c55e);
      }

      .seed-box textarea {
        width: 100%;
        min-height: 120px;
        background: var(--color-gray-950, #030712);
        color: var(--color-gray-100, #f3f4f6);
        border: 1px solid var(--color-gray-700, #374151);
        padding: var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        resize: vertical;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }

      .seed-box textarea:focus {
        outline: 2px solid var(--color-success, #22c55e);
        outline-offset: 1px;
        border-color: var(--color-success, #22c55e);
        box-shadow: 0 0 0 1px rgba(74 222 128 / 0.3);
      }

      .seed-box textarea::placeholder {
        color: var(--color-gray-500, #6b7280);
      }

      .seed-box textarea:disabled {
        opacity: 0.5;
      }

      /* ── Seed Footer (counter + language hint) ── */

      .seed-box__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--space-2);
        gap: var(--space-3);
      }

      .seed-box__lang-hint {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-gray-500, #6b7280);
        letter-spacing: 0.03em;
      }

      .seed-box__lang-hint svg {
        flex-shrink: 0;
      }

      .seed-counter {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        letter-spacing: 0.05em;
        color: var(--color-gray-500, #6b7280);
        text-align: right;
        white-space: nowrap;
        transition: color 0.2s;
      }

      .seed-counter--warning {
        color: var(--color-warning, #f59e0b);
      }

      .seed-counter--danger {
        color: var(--color-danger, #ef4444);
      }

      /* ── Seed Suggestions ─────────────────── */

      .seed-suggestions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-2);
        margin-top: var(--space-3);
      }

      .seed-suggestion {
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        line-height: 1.5;
        color: var(--color-gray-400, #9ca3af);
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-gray-700, #374151);
        cursor: pointer;
        transition: all 0.15s;
        text-align: left;
        white-space: normal;
      }

      .seed-suggestion:hover {
        border-color: var(--color-success, #22c55e);
        color: var(--color-success, #22c55e);
      }

      /* ── Anchor Fan ─────────────────────── */

      .anchor-fan {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0;
        padding: var(--space-6) var(--space-4) var(--space-8);
        perspective: 1000px;
        min-height: 420px;
      }

      .anchor-fan__card {
        transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        cursor: pointer;
        margin-left: -30px;
        transform-origin: bottom center;
      }

      .anchor-fan__card:first-child {
        margin-left: 0;
      }

      .anchor-fan__card:hover {
        z-index: 10;
        transform: translateY(-20px) scale(1.05) !important;
      }

      .anchor-fan__card--selected {
        z-index: 20;
        transform: translateY(-30px) scale(1.1) !important;
      }

      .anchor-fan__card--dimmed {
        opacity: 0.55;
        filter: grayscale(0.4) brightness(0.7);
      }

      /* ── Dossier Card ─────────────────────── */

      .dossier {
        width: 240px;
        min-height: 370px;
        background: var(--color-gray-950, #030712);
        border: 1px solid var(--color-gray-600, #4b5563);
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
        box-shadow:
          0 4px 24px rgba(0 0 0 / 0.6),
          0 0 1px rgba(74 222 128 / 0.2);
        transition: box-shadow 0.3s, border-color 0.3s;
      }

      .anchor-fan__card:hover .dossier,
      .anchor-fan__card--selected .dossier {
        border-color: var(--color-success, #22c55e);
        box-shadow:
          0 8px 40px rgba(0 0 0 / 0.7),
          0 0 20px rgba(74 222 128 / 0.12),
          inset 0 0 30px rgba(74 222 128 / 0.03);
      }

      /* Corner brackets */
      .dossier::before,
      .dossier::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border-color: var(--color-gray-500, #6b7280);
        border-style: solid;
        transition: border-color 0.3s;
        z-index: 2;
      }

      .dossier::before {
        top: 6px;
        left: 6px;
        border-width: 1px 0 0 1px;
      }

      .dossier::after {
        bottom: 6px;
        right: 6px;
        border-width: 0 1px 1px 0;
      }

      .anchor-fan__card:hover .dossier::before,
      .anchor-fan__card:hover .dossier::after,
      .anchor-fan__card--selected .dossier::before,
      .anchor-fan__card--selected .dossier::after {
        border-color: var(--color-success, #22c55e);
      }

      /* Classification header strip */
      .dossier__classification {
        padding: 6px 12px;
        background: rgba(74 222 128 / 0.08);
        border-bottom: 1px solid var(--color-gray-700, #374151);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .dossier__class-label {
        font-family: var(--font-mono, monospace);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--color-success, #22c55e);
      }

      .dossier__class-id {
        font-family: var(--font-mono, monospace);
        font-size: 9px;
        color: var(--color-gray-400, #9ca3af);
      }

      /* Geometric sigil / visual anchor */
      .dossier__sigil {
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        background:
          radial-gradient(ellipse at center, rgba(74 222 128 / 0.04) 0%, transparent 70%);
      }

      .dossier__sigil-shape {
        width: 56px;
        height: 56px;
        border: 1px solid rgba(74 222 128 / 0.25);
        transform: rotate(45deg);
        position: relative;
      }

      .dossier__sigil-shape::before {
        content: '';
        position: absolute;
        inset: 8px;
        border: 1px solid rgba(74 222 128 / 0.15);
      }

      .dossier__sigil-shape::after {
        content: '';
        position: absolute;
        inset: 16px;
        background: rgba(74 222 128 / 0.06);
        border: 1px solid rgba(74 222 128 / 0.1);
      }

      /* Horizontal scan line across sigil */
      .dossier__sigil::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(74 222 128 / 0.3), transparent);
        top: 50%;
      }

      .anchor-fan__card:hover .dossier__sigil-shape,
      .anchor-fan__card--selected .dossier__sigil-shape {
        border-color: rgba(74 222 128 / 0.5);
        box-shadow: 0 0 20px rgba(74 222 128 / 0.1);
      }

      /* Title section */
      .dossier__body {
        flex: 1;
        padding: 16px 16px 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        border-top: 1px solid var(--color-gray-800, #1f2937);
        overflow: hidden;
        min-height: 0;
      }

      .dossier__title {
        font-family: var(--font-brutalist);
        font-weight: 900;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        line-height: 1.3;
        color: var(--color-gray-100, #f3f4f6);
        margin: 0;
        /* Allow wrapping — never truncate */
        white-space: normal;
        word-break: break-word;
      }

      /* Literary influence — styled as source reference */
      .dossier__source {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        line-height: 1.5;
        color: var(--color-gray-400, #9ca3af);
        padding-top: 8px;
        border-top: 1px solid var(--color-gray-800, #1f2937);
        white-space: normal;
        word-break: break-word;
      }

      .dossier__source::before {
        content: 'SRC: ';
        color: var(--color-gray-400, #9ca3af);
      }

      /* Core question — prophetic text */
      .dossier__question {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        font-style: italic;
        line-height: 1.5;
        color: var(--color-success, #22c55e);
        white-space: normal;
        margin: 0;
        opacity: 0.85;
      }

      .dossier__question::before {
        content: '» ';
      }

      /* Footer with dossier number */
      .dossier__footer {
        padding: 6px 12px;
        border-top: 1px solid var(--color-gray-800, #1f2937);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .dossier__index {
        font-family: var(--font-mono, monospace);
        font-size: 20px;
        font-weight: 900;
        color: var(--color-gray-700, #374151);
        line-height: 1;
      }

      .anchor-fan__card--selected .dossier__index {
        color: var(--color-success, #22c55e);
      }

      .dossier__status {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--color-gray-400, #9ca3af);
      }

      .anchor-fan__card--selected .dossier__status {
        color: var(--color-success, #22c55e);
      }

      /* Deal animation */
      .anchor-fan__card--dealing {
        animation: card-deal 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .anchor-fan__card--dealing:nth-child(1) { animation-delay: 0ms; }
      .anchor-fan__card--dealing:nth-child(2) { animation-delay: 200ms; }
      .anchor-fan__card--dealing:nth-child(3) { animation-delay: 400ms; }

      @keyframes card-deal {
        from {
          opacity: 0;
          transform: translateY(-80px) rotateZ(0deg) scale(0.75);
        }
        60% {
          opacity: 1;
        }
        to {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .anchor-fan__card--dealing {
          animation: none;
        }
      }

      /* ── Anchor Detail (below fan) ──────── */

      .anchor-detail {
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-success, #22c55e);
        padding: var(--space-6);
        box-shadow: 0 0 20px rgba(74 222 128 / 0.1);
      }

      .anchor-detail__question {
        font-weight: var(--font-bold, 700);
        font-size: var(--text-base);
        color: var(--color-gray-100, #f3f4f6);
        margin: 0 0 var(--space-3);
      }

      .anchor-detail__description {
        font-size: var(--text-sm);
        color: var(--color-gray-400, #9ca3af);
        line-height: 1.6;
        margin: 0;
      }

      /* ── Forge Parameters Panel ─────────── */

      .forge-params {
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-gray-700, #374151);
        padding: var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      .forge-params__title {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-gray-400, #9ca3af);
        margin: 0;
        padding-bottom: var(--space-3);
        border-bottom: 1px solid var(--color-gray-700, #374151);
      }

      /* ── Footer ──────────────────────────── */

      .astrolabe__footer {
        display: flex;
        justify-content: flex-end;
        margin-top: var(--space-8);
      }

      .btn--advance {
        background: var(--color-gray-800, #1f2937);
        border-color: var(--color-gray-600, #4b5563);
        color: var(--color-gray-100, #f3f4f6);
        padding: var(--space-2-5, 10px) var(--space-6);
      }

      .btn--advance:hover:not(:disabled) {
        background: var(--color-gray-700, #374151);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0 0 0 / 0.3);
      }

      /* ── Responsive ──────────────────────── */

      @media (max-width: 640px) {
        .anchor-fan {
          flex-wrap: wrap;
          padding: var(--space-6) 0;
          min-height: auto;
          gap: var(--space-4);
        }

        .anchor-fan__card {
          margin-left: 0;
        }

        .dossier {
          width: 200px;
          min-height: 320px;
        }

        .dossier__sigil {
          height: 70px;
        }

        .dossier__title {
          font-size: 12px;
        }
      }

      @media (max-width: 480px) {
        .seed-suggestions {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  private static readonly _SEED_MAX = 1500;

  @state() private _seed = '';
  @state() private _selectedIdx: number | null = null;
  @state() private _isGenerating = false;
  @state() private _error: string | null = null;
  @state() private _options: PhilosophicalAnchor[] = [];
  @state() private _isDealing = true;
  @state() private _genConfig = forgeStateManager.generationConfig.value;

  private _disposeEffects: (() => void)[] = [];
  private _hasScrolledToAnchors = false;

  connectedCallback() {
    super.connectedCallback();

    this._disposeEffects.push(
      effect(() => {
        const draft = forgeStateManager.draft.value;
        this._seed = draft?.seed_prompt ?? '';
        this._options = (draft?.philosophical_anchor?.options as PhilosophicalAnchor[]) ?? [];
        if (this._options.length > 0) {
          this._isDealing = true;
          setTimeout(() => {
            this._isDealing = false;
          }, 800);
          // Auto-scroll to anchor cards after first appearance
          if (!this._hasScrolledToAnchors) {
            this._hasScrolledToAnchors = true;
            this.updateComplete.then(() => {
              const fan = this.renderRoot.querySelector('.anchor-fan');
              fan?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }
        }
      }),
      effect(() => {
        const generating = forgeStateManager.isGenerating.value;
        this._isGenerating = generating;
        if (generating) {
          this.updateComplete.then(() => {
            const overlay = this.renderRoot.querySelector('velg-forge-scan-overlay');
            overlay?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        }
      }),
      effect(() => {
        this._error = forgeStateManager.error.value;
      }),
      effect(() => {
        this._genConfig = forgeStateManager.generationConfig.value;
      }),
    );
  }

  disconnectedCallback() {
    for (const dispose of this._disposeEffects) dispose();
    this._disposeEffects = [];
    this._hasScrolledToAnchors = false;
    super.disconnectedCallback();
  }

  private static readonly _SCAN_PHASES = [
    'Establishing Neural Link',
    'Parsing Dimensional Frequencies',
    'Triangulating Shard Coordinates',
    'Intercepting Philosophical Transmissions',
    'Crystallizing Anchor Points',
  ];

  private async _handleResearch() {
    if (!this._seed) return;
    if (!forgeStateManager.draft.value) {
      await forgeStateManager.createDraft(this._seed);
    }
    await forgeStateManager.startResearch();
  }

  private _selectAnchor(idx: number) {
    this._selectedIdx = idx;
    const selected = this._options[idx];
    forgeStateManager.updateDraft({
      philosophical_anchor: {
        options: forgeStateManager.draft.value?.philosophical_anchor?.options ?? [],
        selected,
      },
    });
    // Scroll to the anchor detail + forge params that appear below the fan
    this.updateComplete.then(() => {
      const detail = this.renderRoot.querySelector('.anchor-detail');
      detail?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private _fillSeed(text: string) {
    this._seed = text;
  }

  private _updateGenConfig(field: string, value: number) {
    forgeStateManager.updateGenerationConfig({ [field]: value });
  }

  private _handleNext() {
    if (this._selectedIdx !== null) {
      forgeStateManager.updateDraft({ current_phase: 'drafting' });
    }
  }

  private _fanRotation(index: number, total: number): string {
    return fanRotation(index, total, 8, 6);
  }

  private _renderInfoBubble(text: string, example: string) {
    return renderInfoBubble(text, example);
  }

  protected render() {
    return html`
      <div class="astrolabe">
        <div class="seed-box">
          <div class="seed-box__header">
            <span class="seed-box__title">${msg('The Initial Seed')}</span>
            ${this._renderInfoBubble(
              msg(
                'Describe the core concept of your simulation world. Think in themes, contradictions, and atmospheres — not plot.',
              ),
              msg(
                'A floating archipelago where memories solidify into islands and forgetting causes erosion',
              ),
            )}
          </div>
          <textarea
            .value=${this._seed}
            @input=${(e: InputEvent) => (this._seed = (e.target as HTMLTextAreaElement).value)}
            placeholder=${msg('Describe the memory that broke off to form this Shard...')}
            maxlength=${VelgForgeAstrolabe._SEED_MAX}
            ?disabled=${this._isGenerating}
            aria-label=${msg('Seed prompt')}
          ></textarea>

          <div class="seed-box__footer">
            <span class="seed-box__lang-hint">
              ${this._renderInfoBubble(
                msg(
                  'Write in any language — the AI interprets your concept regardless of language. Focus on atmosphere, themes, and contradictions.',
                ),
                msg(
                  'Ein schwimmender Archipel, wo Erinnerungen zu Inseln erstarren — works just as well as English.',
                ),
              )}
              <span>${msg('Any language')}</span>
            </span>
            <span class="seed-counter ${this._seed.length > VelgForgeAstrolabe._SEED_MAX * 0.9 ? (this._seed.length >= VelgForgeAstrolabe._SEED_MAX ? 'seed-counter--danger' : 'seed-counter--warning') : ''}">
              ${VelgForgeAstrolabe._SEED_MAX - this._seed.length}
            </span>
          </div>

          <div class="seed-suggestions">
            ${SEED_SUGGESTIONS.map(
              (s) => html`
              <button
                class="seed-suggestion"
                @click=${() => this._fillSeed(s)}
                ?disabled=${this._isGenerating}
                title=${s}
              >${s}</button>
            `,
            )}
          </div>

          ${
            !this._isGenerating
              ? html`
            <button
              class="btn btn--next"
              style="margin-top: var(--space-4)"
              ?disabled=${!this._seed}
              @click=${this._handleResearch}
            >${msg('Scan Multiverse')}</button>
          `
              : nothing
          }
        </div>

        <velg-forge-scan-overlay
          ?active=${this._isGenerating}
          .phases=${VelgForgeAstrolabe._SCAN_PHASES}
          .lockLabels=${[msg('Anchor 1'), msg('Anchor 2'), msg('Anchor 3')]}
          headerLabel=${msg('Bureau Signal Intelligence')}
          .echoText=${this._seed}
        ></velg-forge-scan-overlay>

        ${this._error ? html`<div class="error-banner" role="alert">${this._error}</div>` : nothing}

        ${
          this._options.length > 0
            ? html`
          <div class="anchor-fan" role="radiogroup" aria-label=${msg('Philosophical Anchors')}>
            ${this._options.map(
              (opt, i) => html`
              <div
                class="anchor-fan__card ${this._isDealing ? 'anchor-fan__card--dealing' : ''} ${this._selectedIdx === i ? 'anchor-fan__card--selected' : ''} ${this._selectedIdx !== null && this._selectedIdx !== i ? 'anchor-fan__card--dimmed' : ''}"
                style="transform: ${this._selectedIdx === i ? 'translateY(-30px) scale(1.1)' : this._fanRotation(i, this._options.length)}"
                role="radio"
                tabindex="0"
                aria-checked=${this._selectedIdx === i ? 'true' : 'false'}
                aria-label=${opt.title}
                @click=${() => this._selectAnchor(i)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._selectAnchor(i);
                  }
                }}
              >
                <div class="dossier">
                  <div class="dossier__classification">
                    <span class="dossier__class-label">${msg('Anchor')}</span>
                    <span class="dossier__class-id">ANC-${String(i + 1).padStart(3, '0')}</span>
                  </div>
                  <div class="dossier__sigil">
                    <div class="dossier__sigil-shape"></div>
                  </div>
                  <div class="dossier__body">
                    <h3 class="dossier__title">${opt.title}</h3>
                    <p class="dossier__question">${t(opt, 'core_question')}</p>
                    <div class="dossier__source">${opt.literary_influence}</div>
                  </div>
                  <div class="dossier__footer">
                    <span class="dossier__index">${String(i + 1).padStart(2, '0')}</span>
                    <span class="dossier__status">${this._selectedIdx === i ? msg('Selected') : msg('Classified')}</span>
                  </div>
                </div>
              </div>
            `,
            )}
          </div>

          ${
            this._selectedIdx !== null
              ? html`
            <div class="anchor-detail">
              <p class="anchor-detail__question">${t(this._options[this._selectedIdx], 'core_question')}</p>
              <p class="anchor-detail__description">${t(this._options[this._selectedIdx], 'description')}</p>
            </div>
          `
              : nothing
          }

          ${
            this._selectedIdx !== null
              ? html`
            <div class="forge-params">
              <div class="forge-params__title">${msg('Forge Parameters')}</div>

              <div class="range-field">
                <div class="range-field__header">
                  <label class="range-field__label">
                    ${msg('Operatives (agents)')}
                    ${this._renderInfoBubble(
                      msg(
                        'Number of unique characters (NPCs) to generate. Each agent gets a name, profession, personality, and background.',
                      ),
                      msg(
                        '6 agents gives a good social dynamic. 3 for intimate, 12 for complex political intrigue.',
                      ),
                    )}
                  </label>
                  <span class="range-field__readout">${this._genConfig.agent_count}</span>
                </div>
                <input type="range" min="3" max="12" step="1"
                  .value=${String(this._genConfig.agent_count)}
                  @input=${(e: Event) => this._updateGenConfig('agent_count', Number.parseInt((e.target as HTMLInputElement).value, 10))}
                />
              </div>

              <div class="range-field">
                <div class="range-field__header">
                  <label class="range-field__label">
                    ${msg('Structures (buildings)')}
                    ${this._renderInfoBubble(
                      msg(
                        'Number of unique structures to generate. Buildings define the physical infrastructure of your city.',
                      ),
                      msg('7 buildings covers essential services. More adds economic depth.'),
                    )}
                  </label>
                  <span class="range-field__readout">${this._genConfig.building_count}</span>
                </div>
                <input type="range" min="3" max="12" step="1"
                  .value=${String(this._genConfig.building_count)}
                  @input=${(e: Event) => this._updateGenConfig('building_count', Number.parseInt((e.target as HTMLInputElement).value, 10))}
                />
              </div>

              <div class="range-field">
                <div class="range-field__header">
                  <label class="range-field__label">
                    ${msg('Districts (zones)')}
                    ${this._renderInfoBubble(
                      msg(
                        'Number of distinct districts in the generated city. Zones have unique characteristics and atmosphere.',
                      ),
                      msg('5 zones creates a navigable city. 8 for a sprawling metropolis.'),
                    )}
                  </label>
                  <span class="range-field__readout">${this._genConfig.zone_count}</span>
                </div>
                <input type="range" min="3" max="8" step="1"
                  .value=${String(this._genConfig.zone_count)}
                  @input=${(e: Event) => this._updateGenConfig('zone_count', Number.parseInt((e.target as HTMLInputElement).value, 10))}
                />
              </div>

              <div class="range-field">
                <div class="range-field__header">
                  <label class="range-field__label">
                    ${msg('Transit Routes (streets)')}
                    ${this._renderInfoBubble(
                      msg(
                        'Number of named streets connecting zones. Streets are where agents encounter each other.',
                      ),
                      msg('5 streets per zone creates good connectivity.'),
                    )}
                  </label>
                  <span class="range-field__readout">${this._genConfig.street_count}</span>
                </div>
                <input type="range" min="3" max="8" step="1"
                  .value=${String(this._genConfig.street_count)}
                  @input=${(e: Event) => this._updateGenConfig('street_count', Number.parseInt((e.target as HTMLInputElement).value, 10))}
                />
              </div>

              <label class="toggle-field">
                <input type="checkbox"
                  .checked=${this._genConfig.deep_research}
                  @change=${(e: Event) => forgeStateManager.updateGenerationConfig({ deep_research: (e.target as HTMLInputElement).checked })}
                />
                <span class="toggle-field__label">${msg('Deep Research')}</span>
                <span class="toggle-field__hint">${msg('Run literary & philosophical research before lore generation. Produces richer, citation-grounded worldbuilding.')}</span>
              </label>
            </div>

            <div class="astrolabe__footer">
              <button
                class="btn btn--advance"
                @click=${this._handleNext}
              >
                ${msg('Descend to Table')} &ensp; &rarr;
              </button>
            </div>
          `
              : nothing
          }
        `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-astrolabe': VelgForgeAstrolabe;
  }
}
