/**
 * Dungeon Audio Settings — analog VU meter control panel.
 *
 * Renders inside a <dialog> opened from the DungeonHeader.
 * Aesthetic: 1970s submarine instrument panel — sliders as fader bars,
 * toggles as rocker switches, all in CRT amber phosphor.
 *
 * Pattern: DungeonHeader.ts (SignalWatcher, terminal tokens, no API calls).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

import { dungeonAudio } from '../../services/DungeonAudioService.js';
import { icons } from '../../utils/icons.js';
import { terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';

@localized()
@customElement('velg-dungeon-audio-settings')
export class VelgDungeonAudioSettings extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: block;
        font-family: var(--_mono);
        color: var(--_phosphor-dim);
        font-size: 11px;
        letter-spacing: 0.5px;
      }

      .panel {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 280px;
      }

      /* ── Header ── */
      .panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 10px;
        border-bottom: 1px dashed color-mix(in srgb, var(--_border) 50%, transparent);
      }

      .panel__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor);
      }

      /* ── Enable Toggle ── */
      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 0;
      }

      .toggle-row__label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: var(--_phosphor-dim);
      }

      .toggle-row__icon {
        display: inline-flex;
        color: var(--_phosphor-dim);
      }

      .toggle-row__icon--active {
        color: var(--_phosphor);
      }

      /* Rocker switch toggle */
      .rocker {
        position: relative;
        width: 38px;
        height: 20px;
        background: color-mix(in srgb, var(--_border) 40%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 60%, transparent);
        cursor: pointer;
        flex-shrink: 0;
      }

      .rocker::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        background: var(--_phosphor-dim);
        transition: transform 0.15s ease, background 0.15s ease;
      }

      .rocker--on {
        border-color: color-mix(in srgb, var(--_phosphor) 50%, transparent);
      }

      .rocker--on::after {
        transform: translateX(18px);
        background: var(--_phosphor);
        box-shadow: 0 0 6px color-mix(in srgb, var(--_phosphor-glow) 40%, transparent);
      }

      @media (prefers-reduced-motion: reduce) {
        .rocker::after {
          transition: none;
        }
      }

      /* ── Fader Channel ── */
      .channel {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 0;
      }

      .channel + .channel {
        border-top: 1px dashed color-mix(in srgb, var(--_border) 30%, transparent);
        padding-top: 12px;
      }

      .channel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .channel__label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor-dim);
      }

      .channel__mute {
        border: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
        background: none;
        color: var(--_phosphor-dim);
        font-family: var(--_mono);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        padding: 2px 8px;
        cursor: pointer;
      }

      .channel__mute:hover {
        border-color: var(--_phosphor);
        color: var(--_phosphor);
      }

      .channel__mute--active {
        background: color-mix(in srgb, var(--color-danger, #f87171) 15%, transparent);
        border-color: color-mix(in srgb, var(--color-danger, #f87171) 40%, transparent);
        color: var(--color-danger, #f87171);
      }

      .channel__mute--active:hover {
        border-color: var(--color-danger, #f87171);
        color: var(--color-danger, #f87171);
      }

      /* ── Fader Track (analog VU meter bar) ── */
      .fader {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .fader__track {
        position: relative;
        flex: 1;
        height: 8px;
        background: color-mix(in srgb, var(--_border) 30%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
        cursor: pointer;
      }

      .fader__fill {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        background: var(--_phosphor-dim);
        pointer-events: none;
        transition: width 50ms linear;
      }

      .fader__fill--active {
        background: var(--_phosphor);
        box-shadow: inset 0 0 4px color-mix(in srgb, var(--_phosphor-glow) 30%, transparent);
      }

      /* Tick marks on the track */
      .fader__ticks {
        position: absolute;
        inset: 0;
        display: flex;
        pointer-events: none;
      }

      .fader__tick {
        flex: 1;
        border-right: 1px solid color-mix(in srgb, var(--_phosphor-dim) 20%, transparent);
      }

      .fader__tick:last-child {
        border-right: none;
      }

      .fader__value {
        font-size: 10px;
        min-width: 28px;
        text-align: right;
        color: var(--_phosphor-dim);
        font-variant-numeric: tabular-nums;
      }

      .fader__value--muted {
        color: var(--color-danger, #f87171);
      }

      /* ── Slider input (hidden native, covers track for interaction) ── */
      .fader__input {
        position: absolute;
        inset: -4px 0;
        width: 100%;
        height: calc(100% + 8px);
        margin: 0;
        opacity: 0;
        cursor: pointer;
        z-index: 1;
      }

      /* ── Disabled state ── */
      .panel--disabled .channel {
        opacity: 0.3;
        pointer-events: none;
      }

      /* ── Status indicator ── */
      .status {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor-dim);
        opacity: 0.6;
        text-align: center;
        padding-top: 4px;
      }

      .status--ready {
        color: var(--color-success, #4ade80);
      }

      .status--loading {
        color: var(--_phosphor);
      }
    `,
  ];

  protected render() {
    const enabled = dungeonAudio.enabled.value;
    const ready = dungeonAudio.ready.value;

    return html`
      <div class="panel ${enabled ? '' : 'panel--disabled'}">
        <div class="panel__header">
          <span class="panel__title">${msg('Audio')}</span>
        </div>

        ${this._renderEnableToggle(enabled)}
        ${this._renderMasterChannel(enabled)}
        ${this._renderSfxChannel(enabled)}
        ${this._renderAmbientChannel(enabled)}
        ${this._renderStatus(enabled, ready)}
      </div>
    `;
  }

  private _renderEnableToggle(enabled: boolean) {
    return html`
      <div class="toggle-row">
        <span class="toggle-row__label">
          <span class="toggle-row__icon ${enabled ? 'toggle-row__icon--active' : ''}">
            ${enabled ? icons.volume(14) : icons.volumeOff(14)}
          </span>
          ${msg('Enable Audio')}
        </span>
        <button
          class="rocker ${enabled ? 'rocker--on' : ''}"
          role="switch"
          aria-checked=${enabled}
          aria-label=${msg('Toggle audio')}
          @click=${this._toggleEnabled}
        ></button>
      </div>
    `;
  }

  private _renderMasterChannel(enabled: boolean) {
    const vol = dungeonAudio.masterVolume.value;
    return html`
      <div class="channel">
        <div class="channel__header">
          <span class="channel__label">${msg('Master')}</span>
        </div>
        ${this._renderFader(vol, enabled, (v) => dungeonAudio.setMasterVolume(v), false, msg('Master volume'))}
      </div>
    `;
  }

  private _renderSfxChannel(enabled: boolean) {
    const vol = dungeonAudio.sfxVolume.value;
    const muted = dungeonAudio.sfxMuted.value;
    return html`
      <div class="channel">
        <div class="channel__header">
          <span class="channel__label">${msg('SFX')}</span>
          <button
            class="channel__mute ${muted ? 'channel__mute--active' : ''}"
            @click=${() => dungeonAudio.toggleSfxMute()}
            aria-label=${muted ? msg('Unmute SFX') : msg('Mute SFX')}
          >${muted ? msg('Muted') : msg('Mute')}</button>
        </div>
        ${this._renderFader(vol, enabled && !muted, (v) => dungeonAudio.setSfxVolume(v), muted, msg('SFX volume'))}
      </div>
    `;
  }

  private _renderAmbientChannel(enabled: boolean) {
    const vol = dungeonAudio.ambientVolume.value;
    const muted = dungeonAudio.ambientMuted.value;
    return html`
      <div class="channel">
        <div class="channel__header">
          <span class="channel__label">${msg('Ambient')}</span>
          <button
            class="channel__mute ${muted ? 'channel__mute--active' : ''}"
            @click=${() => dungeonAudio.toggleAmbientMute()}
            aria-label=${muted ? msg('Unmute ambient') : msg('Mute ambient')}
          >${muted ? msg('Muted') : msg('Mute')}</button>
        </div>
        ${this._renderFader(vol, enabled && !muted, (v) => dungeonAudio.setAmbientVolume(v), muted, msg('Ambient volume'))}
      </div>
    `;
  }

  private _renderFader(
    value: number,
    active: boolean,
    onChange: (v: number) => void,
    muted = false,
    label = msg('Volume'),
  ) {
    const pct = Math.round(value * 100);
    return html`
      <div class="fader">
        <div class="fader__track">
          <div class="fader__ticks">
            ${Array.from({ length: 10 }, () => html`<span class="fader__tick"></span>`)}
          </div>
          <div
            class="fader__fill ${active ? 'fader__fill--active' : ''}"
            style="width: ${pct}%"
          ></div>
          <input
            class="fader__input"
            type="range"
            min="0"
            max="100"
            .value=${String(pct)}
            @input=${(e: Event) => {
              const v = parseInt((e.target as HTMLInputElement).value, 10);
              onChange(v / 100);
            }}
            aria-label=${label}
          />
        </div>
        <span class="fader__value ${muted ? 'fader__value--muted' : ''}">${pct}%</span>
      </div>
    `;
  }

  private _renderStatus(enabled: boolean, ready: boolean) {
    if (!enabled) return nothing;

    return html`
      <div class="status ${ready ? 'status--ready' : 'status--loading'}">
        ${ready ? msg('SFX loaded') : msg('Loading...')}
      </div>
    `;
  }

  private async _toggleEnabled(): Promise<void> {
    await dungeonAudio.toggle();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-audio-settings': VelgDungeonAudioSettings;
  }
}
