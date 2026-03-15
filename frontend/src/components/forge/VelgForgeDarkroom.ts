import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { VelgToast } from '../shared/Toast.js';
import {
  forgeBackButtonStyles,
  forgeButtonStyles,
  forgeFieldStyles,
  forgeInfoBubbleStyles,
  forgeRangeStyles,
  forgeStatusStyles,
} from './forge-console-styles.js';
import { t } from '../../utils/locale-fields.js';
import { renderInfoBubble } from './forge-utils.js';

import '../shared/VelgFontPicker.js';
import '../shared/VelgGameCard.js';
import '../shared/VelgStyleReferenceUpload.js';
import './VelgForgeScanOverlay.js';

/**
 * Phase III: The Darkroom — Aesthetic Control Center.
 * AI theme generation + preview + image generation settings.
 */
@localized()
@customElement('velg-forge-darkroom')
export class VelgForgeDarkroom extends LitElement {
  static styles = [
    forgeButtonStyles,
    forgeBackButtonStyles,
    forgeFieldStyles,
    forgeRangeStyles,
    forgeStatusStyles,
    forgeInfoBubbleStyles,
    css`
      :host {
        display: block;
      }

      /* ── Two-Column Layout ───────────────── */

      .darkroom {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-8);
      }

      @media (max-width: 900px) {
        .darkroom { grid-template-columns: 1fr; }
      }

      /* ── Section Header ────────────────────── */

      .darkroom__section-header {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-gray-400, #9ca3af);
        padding-bottom: var(--space-3);
        border-bottom: 1px solid var(--color-gray-700, #374151);
        margin-bottom: var(--space-4);
        grid-column: 1 / -1;
      }

      /* ── Controls Pane ───────────────────── */

      .controls {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-gray-700, #374151);
        padding: var(--space-6);
      }

      .controls__title {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-success, #22c55e);
        margin: 0;
      }

      /* ── Color Grid ────────────────────────── */

      .color-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }

      .color-field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .color-field__label {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        display: flex;
        align-items: baseline;
        gap: var(--space-1);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-gray-300, #d1d5db);
      }

      .color-field__hint {
        font-size: 9px;
        text-transform: none;
        letter-spacing: normal;
        color: var(--color-gray-500, #6b7280);
      }

      .color-field__row {
        display: flex;
        gap: var(--space-2);
        align-items: center;
      }

      .color-field input[type='color'] {
        width: 40px;
        height: 40px;
        border: 1px solid var(--color-gray-600, #4b5563);
        background: transparent;
        cursor: pointer;
        padding: 0;
        transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
      }

      .color-field input[type='color']:hover {
        transform: scale(1.15);
        border-color: var(--color-gray-400, #9ca3af);
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
      }

      .color-field input[type='color']:focus {
        outline: 2px solid var(--color-success, #22c55e);
        outline-offset: 1px;
      }

      .color-field input[type='text'] {
        flex: 1;
        background: var(--color-gray-950, #030712);
        color: var(--color-gray-100, #f3f4f6);
        border: 1px solid var(--color-gray-700, #374151);
        padding: var(--space-1) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        box-sizing: border-box;
      }

      /* ── Chip Selectors ────────────────────── */

      .chip-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .chip-group__label {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-gray-300, #d1d5db);
      }

      .chip-group__row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        min-width: 44px;
        padding: var(--space-1) var(--space-2);
        background: var(--color-gray-950, #030712);
        border: 1px solid var(--color-gray-700, #374151);
        color: var(--color-gray-300, #d1d5db);
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        cursor: pointer;
        transition: background 0.12s, border-color 0.12s, color 0.12s, box-shadow 0.12s;
        white-space: nowrap;
        box-sizing: border-box;
      }

      .chip:hover {
        background: var(--color-gray-800, #1f2937);
      }

      .chip[aria-pressed='true'] {
        border-color: var(--color-success, #22c55e);
        color: var(--color-success, #22c55e);
        box-shadow: 0 0 6px rgba(34, 197, 94, 0.2);
      }

      .chip__glyph {
        font-size: 12px;
        line-height: 1;
      }

      .chip-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }

      @media (max-width: 480px) {
        .color-grid,
        .chip-grid {
          grid-template-columns: 1fr;
        }
      }

      /* ── Preview Pane ────────────────────── */

      .preview-pane {
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-gray-700, #374151);
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-6);
        position: relative;
      }

      .preview-pane__title {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-gray-400, #9ca3af);
      }

      /* Live preview swatches */
      .preview-swatches {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .preview-swatch {
        width: 40px;
        height: 40px;
        border: 1px solid var(--color-gray-600, #4b5563);
        position: relative;
      }

      .preview-swatch__label {
        position: absolute;
        bottom: -16px;
        left: 50%;
        transform: translateX(-50%);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-gray-400, #9ca3af);
        white-space: nowrap;
      }

      /* Preview heading sample */
      .preview-heading {
        font-weight: 700;
        font-size: var(--text-xl);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: var(--space-4) 0 0;
      }

      /* Preview button sample */
      .preview-button {
        display: inline-block;
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        cursor: default;
        margin-top: var(--space-2);
      }

      /* Preview cards row */
      .preview-cards {
        display: flex;
        gap: var(--space-3);
        justify-content: center;
        flex-wrap: wrap;
      }

      /* ── Image Settings Section ──────────── */

      .image-settings {
        grid-column: 1 / -1;
        background: var(--color-gray-900, #111827);
        border: 1px solid var(--color-gray-700, #374151);
        padding: var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      .formula-readout {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-gray-300, #d1d5db);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: var(--space-2) var(--space-3);
        background: var(--color-gray-950, #030712);
        border: 1px solid var(--color-gray-800, #1f2937);
        text-align: center;
      }

      /* ── Footer ──────────────────────────── */

      .darkroom__footer {
        grid-column: 1 / -1;
        padding-top: var(--space-6);
        border-top: 1px solid var(--color-gray-700, #374151);
      }
    `,
  ];

  @state() private _themeConfig: Record<string, string> = {};
  @state() private _isGeneratingTheme = false;
  @state() private _stylePromptPortrait = '';
  @state() private _stylePromptBuilding = '';
  @state() private _stylePromptBanner = '';
  @state() private _stylePromptLore = '';
  @state() private _guidanceScale = 7.5;
  @state() private _inferenceSteps = 28;
  @state() private _styleRefPortrait = '';
  @state() private _styleRefBuilding = '';
  @state() private _styleRefPortraitLoading = false;
  @state() private _styleRefBuildingLoading = false;
  private _disposeEffects: (() => void)[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._disposeEffects.push(
      effect(() => {
        const draft = forgeStateManager.draft.value;
        const tc = draft?.theme_config ?? {};
        this._themeConfig = tc;
        // theme_config presence tracked via signal, not local state
        const settings = draft?.ai_settings as Record<string, string | number> | undefined;
        // Style prompts: prefer ai_settings (user override), fallback to theme_config (AI-generated)
        this._stylePromptPortrait =
          (settings?.image_style_prompt_portrait as string) ||
          (tc.image_style_prompt_portrait as string) ||
          '';
        this._stylePromptBuilding =
          (settings?.image_style_prompt_building as string) ||
          (tc.image_style_prompt_building as string) ||
          '';
        this._stylePromptBanner =
          (settings?.image_style_prompt_banner as string) ||
          (tc.image_style_prompt_banner as string) ||
          '';
        this._stylePromptLore =
          (settings?.image_style_prompt_lore as string) ||
          (tc.image_style_prompt_lore as string) ||
          '';
        this._guidanceScale = (settings?.image_guidance_scale as number) ?? 7.5;
        this._inferenceSteps = (settings?.image_num_inference_steps as number) ?? 28;
        this._styleRefPortrait = (settings?.image_style_ref_portrait as string) || '';
        this._styleRefBuilding = (settings?.image_style_ref_building as string) || '';
      }),
      effect(() => {
        this._isGeneratingTheme = forgeStateManager.isGeneratingTheme.value;
      }),
    );

    // Auto-generate theme on entry if none exists.
    // Check signal directly since effects may not have fired yet.
    const existingTheme = forgeStateManager.draft.value?.theme_config ?? {};
    if (Object.keys(existingTheme).length === 0 && !forgeStateManager.isGeneratingTheme.value) {
      this._generateTheme();
    }
  }

  disconnectedCallback() {
    for (const dispose of this._disposeEffects) dispose();
    this._disposeEffects = [];
    super.disconnectedCallback();
  }

  private async _generateTheme() {
    const result = await forgeStateManager.generateTheme();
    if (result) {
      this._themeConfig = result;
      // Theme now available in draft signal
      VelgToast.success(msg('Visual identity generated.'));
    }
  }

  private _updateThemeKey(key: string, value: string) {
    this._themeConfig = { ...this._themeConfig, [key]: value };
    forgeStateManager.updateDraft({ theme_config: this._themeConfig } as Partial<
      Record<string, unknown>
    >);
  }

  private _updateSettings() {
    forgeStateManager.updateDraft({
      ai_settings: {
        ...forgeStateManager.draft.value?.ai_settings,
        image_style_prompt_portrait: this._stylePromptPortrait,
        image_style_prompt_building: this._stylePromptBuilding,
        image_style_prompt_banner: this._stylePromptBanner,
        image_style_prompt_lore: this._stylePromptLore,
        image_guidance_scale: this._guidanceScale,
        image_num_inference_steps: this._inferenceSteps,
        image_style_ref_portrait: this._styleRefPortrait,
        image_style_ref_building: this._styleRefBuilding,
      },
    });
  }

  private async _handleStyleRefChange(
    type: 'portrait' | 'building',
    e: CustomEvent<{ file?: File; url?: string; action: string }>,
  ) {
    const { file, url, action } = e.detail;
    if (action === 'delete') {
      if (type === 'portrait') this._styleRefPortrait = '';
      else this._styleRefBuilding = '';
      this._updateSettings();
      return;
    }
    if (action === 'upload' && file) {
      // Create a local preview URL immediately
      const previewUrl = URL.createObjectURL(file);
      if (type === 'portrait') {
        this._styleRefPortrait = previewUrl;
        this._styleRefPortraitLoading = false;
      } else {
        this._styleRefBuilding = previewUrl;
        this._styleRefBuildingLoading = false;
      }
      // Note: actual upload to storage happens at ignition time via the forge orchestrator.
      // For now, store the blob URL in ai_settings as a placeholder.
      this._updateSettings();
    } else if (action === 'url' && url) {
      if (type === 'portrait') this._styleRefPortrait = url;
      else this._styleRefBuilding = url;
      this._updateSettings();
    }
  }

  private _handleIgnite() {
    this._updateSettings();
    forgeStateManager.updateDraft({ current_phase: 'ignition' });
  }

  private _renderInfoBubble(text: string, example: string) {
    return renderInfoBubble(text, example);
  }

  private _renderColorField(key: string, label: string, hint?: string) {
    const value = this._themeConfig[key] || '#000000';
    return html`
      <div class="color-field">
        <span class="color-field__label">${label}${hint ? html` <span class="color-field__hint">${hint}</span>` : nothing}</span>
        <div class="color-field__row">
          <input type="color" .value=${value}
            @input=${(e: Event) => this._updateThemeKey(key, (e.target as HTMLInputElement).value)} />
          <input type="text" .value=${value}
            @change=${(e: Event) => this._updateThemeKey(key, (e.target as HTMLInputElement).value)} />
        </div>
      </div>
    `;
  }

  private static _chipGlyphs: Record<string, Record<string, string>> = {
    shadow_style: { offset: '__|', blur: '...', glow: '(*)', none: '---' },
    hover_effect: { translate: '↑↑', scale: '<+>', glow: '(*)' },
    card_frame_texture: {
      none: '---', filigree: '~*~', circuits: '[#]',
      scanlines: '|||', rivets: 'o·o', illumination: '❋',
    },
    card_frame_nameplate: {
      terminal: '>_', banner: '═/═', readout: '[=]',
      plate: '|=|', cartouche: '(~)',
    },
    card_frame_corners: {
      none: '···', tentacles: '~.~', brackets: '[.]',
      crosshairs: '+.+', bolts: 'o.o', floral: '✿',
    },
    card_frame_foil: {
      holographic: '◇', aquatic: '≈', phosphor: '✦',
      patina: '··', gilded: '✧',
    },
  };

  private _renderChipSelector(key: string, label: string, options: string[]) {
    const value = this._themeConfig[key] || options[0];
    const glyphs = VelgForgeDarkroom._chipGlyphs[key] ?? {};
    return html`
      <div class="chip-group">
        <span class="chip-group__label">${label}</span>
        <div class="chip-group__row">
          ${options.map(
            (opt) => html`
              <button
                class="chip"
                aria-pressed=${value === opt ? 'true' : 'false'}
                @click=${() => this._updateThemeKey(key, opt)}
              >
                <span class="chip__glyph">${glyphs[opt] ?? ''}</span>
                ${opt}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _handleBack() {
    forgeStateManager.updateDraft({ current_phase: 'drafting' });
  }

  protected render() {
    if (this._isGeneratingTheme) {
      return html`
        <velg-forge-scan-overlay
          active
          .phases=${[msg('Sampling Chromatic Frequencies'), msg('Calibrating Visual Identity'), msg('Synthesizing Design Language'), msg('Rendering Aesthetic Profile'), msg('Encoding Theme Matrix')]}
          .lockLabels=${[msg('Color'), msg('Type'), msg('Style')]}
          headerLabel=${msg('Aesthetic Calibration Bureau')}
        ></velg-forge-scan-overlay>
      `;
    }

    const tc = this._themeConfig;
    const agents = forgeStateManager.draft.value?.agents ?? [];
    const firstAgent = agents[0];

    return html`
      <div class="darkroom">
        <div class="darkroom__section-header">${msg('Theme Forge — AI-Generated Visual Identity')}</div>

        <!-- Left: Theme Controls -->
        <div class="controls">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="controls__title">${msg('Color Palette')}</span>
            ${this._renderInfoBubble(
              msg(
                'The AI generated a unique color palette for your simulation. Adjust any color to match your vision.',
              ),
              msg('Click a swatch to open the color picker. The preview updates instantly.'),
            )}
          </div>

          <div class="color-grid">
            ${this._renderColorField('color_primary', msg('Primary'), msg('Buttons, links, active states'))}
            ${this._renderColorField('color_secondary', msg('Secondary'), msg('Badges, secondary actions'))}
            ${this._renderColorField('color_accent', msg('Accent'), msg('Highlights, borders, emphasis'))}
            ${this._renderColorField('color_background', msg('Background'), msg('Page background'))}
            ${this._renderColorField('color_surface', msg('Surface'), msg('Cards, panels, overlays'))}
            ${this._renderColorField('color_text', msg('Text'), msg('Body text, headings'))}
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-4)">
            <span class="controls__title">${msg('Typography')}</span>
            ${this._renderInfoBubble(
              msg(
                'Font families for headings and body text. Headings use the brutalist display font by default.',
              ),
              msg("Try 'Playfair Display' for an elegant literary feel."),
            )}
          </div>

          <div class="color-grid">
            <velg-font-picker
              .label=${msg('Heading Font')}
              .value=${tc.font_heading || ''}
              @font-change=${(e: CustomEvent<{ value: string }>) => this._updateThemeKey('font_heading', e.detail.value)}
            ></velg-font-picker>
            <velg-font-picker
              .label=${msg('Body Font')}
              .value=${tc.font_body || ''}
              @font-change=${(e: CustomEvent<{ value: string }>) => this._updateThemeKey('font_body', e.detail.value)}
            ></velg-font-picker>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-4)">
            <span class="controls__title">${msg('Character')}</span>
            ${this._renderInfoBubble(
              msg(
                'Decorative elements on VelgGameCards: texture (background pattern), nameplate (label style), corners (decorative corners), foil (holographic sheen).',
              ),
              msg('Circuits + Terminal + Crosshairs + Phosphor for a cyberpunk feel.'),
            )}
          </div>

          <div class="range-field">
            <div class="range-field__header">
              <label class="range-field__label">
                ${msg('Border Radius')}
                ${this._renderInfoBubble(
                  msg('Corner rounding on cards, buttons, and panels. 0 for sharp brutalist edges.'),
                  msg('0px for military precision. 8px for softer, modern feel.'),
                )}
              </label>
              <span class="range-field__readout">${tc.border_radius || '0'}</span>
            </div>
            <input type="range" min="0" max="16" step="1"
              .value=${String(Number.parseInt(tc.border_radius || '0', 10))}
              @input=${(e: Event) => this._updateThemeKey('border_radius', `${(e.target as HTMLInputElement).value}px`)}
            />
          </div>

          <div class="chip-grid">
            ${this._renderChipSelector('shadow_style', msg('Shadow'), ['offset', 'blur', 'glow', 'none'])}
            ${this._renderChipSelector('hover_effect', msg('Hover'), ['translate', 'scale', 'glow'])}
            ${this._renderChipSelector('card_frame_texture', msg('Card Texture'), ['none', 'filigree', 'circuits', 'scanlines', 'rivets', 'illumination'])}
            ${this._renderChipSelector('card_frame_nameplate', msg('Nameplate'), ['terminal', 'banner', 'readout', 'plate', 'cartouche'])}
            ${this._renderChipSelector('card_frame_corners', msg('Corners'), ['none', 'tentacles', 'brackets', 'crosshairs', 'bolts', 'floral'])}
            ${this._renderChipSelector('card_frame_foil', msg('Foil'), ['holographic', 'aquatic', 'phosphor', 'patina', 'gilded'])}
          </div>

          <button class="btn btn--ghost" @click=${this._generateTheme}>
            ${msg('Regenerate Theme')}
          </button>
        </div>

        <!-- Right: Live Preview -->
        <div class="preview-pane">
          <div class="preview-pane__title">${msg('Live Preview')}</div>

          <div class="preview-swatches">
            ${[
              'color_primary',
              'color_secondary',
              'color_accent',
              'color_background',
              'color_surface',
            ].map(
              (key) => html`
              <div class="preview-swatch" style="background:${tc[key] || '#333'}">
                <span class="preview-swatch__label">${key.replace('color_', '')}</span>
              </div>
            `,
            )}
          </div>

          <div class="preview-heading" style="
            font-family: ${tc.font_heading || 'var(--font-brutalist)'};
            color: ${tc.color_text || '#f3f4f6'};
            font-weight: ${tc.heading_weight || '700'};
            text-transform: ${tc.heading_transform || 'uppercase'};
            letter-spacing: ${tc.heading_tracking || '0.08em'};
          ">${msg('Sample Heading')}</div>

          <div class="preview-button" style="
            background: ${tc.color_primary || '#22c55e'};
            color: ${tc.text_inverse || '#ffffff'};
            border: ${tc.border_width || '2px'} solid ${tc.color_primary || '#22c55e'};
            border-radius: ${tc.border_radius || '0'};
          ">${msg('Sample Button')}</div>

          ${
            firstAgent
              ? html`
            <div class="preview-cards">
              <velg-game-card
                .name=${firstAgent.name}
                .subtitle=${t(firstAgent, 'primary_profession')}
                .description=${t(firstAgent, 'character')}
                .rarity=${'rare'}
                theme="brutalist"
                size="md"
              ></velg-game-card>
            </div>
          `
              : nothing
          }
        </div>

        <!-- Image Generation Settings (full width) -->
        <div class="image-settings">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="controls__title">${msg('Image Generation Parameters')}</span>
          </div>

          <div class="range-field">
            <div class="range-field__header">
              <label class="range-field__label">
                ${msg('Guidance Scale')}
                ${this._renderInfoBubble(
                  msg(
                    'How strictly the AI follows the prompt. Higher = more literal. Lower = more creative.',
                  ),
                  msg('7.5 is the default. Try 12 for photorealistic, 4 for dreamlike.'),
                )}
              </label>
              <span class="range-field__readout">${this._guidanceScale}</span>
            </div>
            <input type="range" min="1" max="20" step="0.5"
              .value=${String(this._guidanceScale)}
              @input=${(e: Event) => {
                this._guidanceScale = Number.parseFloat((e.target as HTMLInputElement).value);
                this._updateSettings();
              }}
            />
          </div>

          <div class="range-field">
            <div class="range-field__header">
              <label class="range-field__label">
                ${msg('Inference Steps')}
                ${this._renderInfoBubble(
                  msg(
                    'Number of denoising iterations. More steps = more detail but slower generation.',
                  ),
                  msg('28 is a good balance. 50 for maximum quality.'),
                )}
              </label>
              <span class="range-field__readout">${this._inferenceSteps}</span>
            </div>
            <input type="range" min="15" max="50" step="1"
              .value=${String(this._inferenceSteps)}
              @input=${(e: Event) => {
                this._inferenceSteps = Number.parseInt((e.target as HTMLInputElement).value, 10);
                this._updateSettings();
              }}
            />
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-3)">
            <label class="field__label">
              ${msg('Image Style Prompts')}
              ${this._renderInfoBubble(
                msg('Text prompts that guide AI image generation for each category. More specific prompts produce more consistent results.'),
                msg("Try 'oil painting, dramatic chiaroscuro, renaissance' for a classical aesthetic."),
              )}
            </label>

            <div style="display:flex;flex-direction:column;gap:var(--space-1)">
              <label class="field__label" style="font-size:var(--text-xs);color:var(--color-text-muted)">${msg('Portraits')} — ${msg('agent character images')}</label>
              <textarea class="field__textarea" rows="2"
                .value=${this._stylePromptPortrait}
                @input=${(e: Event) => {
                  this._stylePromptPortrait = (e.target as HTMLTextAreaElement).value;
                  this._updateSettings();
                }}
                placeholder=${msg('Style for character portraits...')}
              ></textarea>
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-1)">
              <label class="field__label" style="font-size:var(--text-xs);color:var(--color-text-muted)">${msg('Buildings')} — ${msg('location and structure images')}</label>
              <textarea class="field__textarea" rows="2"
                .value=${this._stylePromptBuilding}
                @input=${(e: Event) => {
                  this._stylePromptBuilding = (e.target as HTMLTextAreaElement).value;
                  this._updateSettings();
                }}
                placeholder=${msg('Style for architecture images...')}
              ></textarea>
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-1)">
              <label class="field__label" style="font-size:var(--text-xs);color:var(--color-text-muted)">${msg('Banner')} — ${msg('simulation hero image')}</label>
              <textarea class="field__textarea" rows="2"
                .value=${this._stylePromptBanner}
                @input=${(e: Event) => {
                  this._stylePromptBanner = (e.target as HTMLTextAreaElement).value;
                  this._updateSettings();
                }}
                placeholder=${msg('Style for the world banner...')}
              ></textarea>
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--space-1)">
              <label class="field__label" style="font-size:var(--text-xs);color:var(--color-text-muted)">${msg('Lore Illustrations')} — ${msg('world lore section art')}</label>
              <textarea class="field__textarea" rows="2"
                .value=${this._stylePromptLore}
                @input=${(e: Event) => {
                  this._stylePromptLore = (e.target as HTMLTextAreaElement).value;
                  this._updateSettings();
                }}
                placeholder=${msg('Style for lore illustrations...')}
              ></textarea>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-3)">
            <label class="field__label">
              ${msg('Reference Images (optional)')}
              ${this._renderInfoBubble(
                msg('Upload a reference image to guide the AI art style via img2img. The generated images will visually resemble the reference.'),
                msg('Upload a painting or photo — portraits and buildings will inherit its visual style.'),
              )}
            </label>
            <div class="color-grid">
              <div style="display:flex;flex-direction:column;gap:var(--space-1)">
                <label class="field__label" style="font-size:var(--text-xs);color:var(--color-text-muted)">${msg('Portrait Reference')}</label>
                <velg-style-reference-upload
                  .referenceUrl=${this._styleRefPortrait}
                  entityType="portrait"
                  .loading=${this._styleRefPortraitLoading}
                  aspectHint=${msg('3:4 aspect ratio')}
                  @reference-change=${(e: CustomEvent) => this._handleStyleRefChange('portrait', e)}
                ></velg-style-reference-upload>
              </div>
              <div style="display:flex;flex-direction:column;gap:var(--space-1)">
                <label class="field__label" style="font-size:var(--text-xs);color:var(--color-text-muted)">${msg('Building Reference')}</label>
                <velg-style-reference-upload
                  .referenceUrl=${this._styleRefBuilding}
                  entityType="building"
                  .loading=${this._styleRefBuildingLoading}
                  aspectHint=${msg('4:3 aspect ratio')}
                  @reference-change=${(e: CustomEvent) => this._handleStyleRefChange('building', e)}
                ></velg-style-reference-upload>
              </div>
            </div>
          </div>

          <div class="formula-readout">
            ${msg('GUIDANCE')}: ${this._guidanceScale} | ${msg('STEPS')}: ${this._inferenceSteps}
          </div>
        </div>

        <!-- Footer -->
        <div class="darkroom__footer" style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-4);flex-wrap:wrap">
          <button class="btn btn--back" @click=${this._handleBack}>
            &larr; ${msg('Return to Table')}
          </button>
          <button class="btn btn--launch" @click=${this._handleIgnite}>
            ${msg('Ignite Materialization')} &ensp; &rarr;
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-darkroom': VelgForgeDarkroom;
  }
}
