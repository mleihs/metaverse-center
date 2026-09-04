/**
 * AdminAppearanceTab — welche Ausgabe ein Besucher OHNE eigene Wahl bekommt.
 *
 * Unterreiter unter Admin > Platform Config > Appearance.
 *
 * WAS HIER ENTSCHIEDEN WIRD, UND WAS NICHT
 *   Die Plattform hat zwei Ausgaben: das Phosphor-Chrom und die Kartenmappe.
 *   Wer im Editionsumschalter waehlt, dessen Wahl liegt in seinem Browser und
 *   gilt — diese Seite aendert daran NICHTS. Sie entscheidet nur, womit jemand
 *   anfaengt: jeder Gast, jeder neue Zugang, jeder frische Browser.
 *
 *   Das steht auch so auf der Seite. Eine Verwaltung, die glaubt, hier das
 *   Aussehen aller umzustellen, wuerde die Aenderung fuer wirkungslos halten
 *   und ein zweites Mal daran drehen.
 *
 * WARUM EINE AUSWAHL AUS ZWEIEN UND KEIN SCHALTER
 *   Ein Schalter waere ein "Papier: ja/nein" und damit eine Behauptung, dass
 *   es genau zwei Ausgaben gibt und eine davon die normale ist. Die
 *   Auswahlplatten nennen beide beim Namen und tragen die dritte, wenn sie
 *   kommt, ohne dass diese Datei ihre Bedeutung aendert.
 *
 * DIE VORSCHAU IST DER UMSCHALTER SELBST
 *   Hier gibt es keinen eigenen Vorschauknopf: der Editionsumschalter steht in
 *   der Kopfleiste und im Benutzermenue, und er zeigt die Ausgabe sofort und
 *   vollstaendig. Ein zweiter Weg, dasselbe zu sehen, waere ein zweiter Weg,
 *   der auseinanderlaeuft.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { adminApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import { isPlatformSkin, PLATFORM_SKINS, type PlatformSkin } from '../../services/theme-presets.js';
import type { PlatformSetting } from '../../types/index.js';
import { adminButtonStyles, adminLoadingStyles } from '../shared/admin-shared-styles.js';
import { fieldRowStyles } from '../shared/field-row-styles.js';
import { VelgToast } from '../shared/Toast.js';

const KEY_DEFAULT_SKIN = 'platform_default_skin';

/**
 * Grund, erhobener Grund und Akzent einer Ausgabe — aus ihrer eigenen
 * Konfiguration, nicht aus einer zweiten Liste.
 *
 * `color_background` ist der Schluesselname der Konfiguration; das Token dazu
 * heisst `--color-surface`. Das ist eine bekannte Stolperstelle, deshalb steht
 * es hier: wer nach `color_surface` griffe, bekaeme den ERHOBENEN Grund.
 */
function probeFarben(skin: PlatformSkin): readonly string[] {
  const c = PLATFORM_SKINS[skin];
  return [c.color_background, c.color_surface, c.color_primary].filter(Boolean);
}

/** Wenn der Schluessel fehlt oder etwas trägt, das keine Ausgabe ist. */
const FALLBACK: PlatformSkin = 'dark';

@localized()
@customElement('velg-admin-appearance-tab')
export class VelgAdminAppearanceTab extends LitElement {
  static styles = [
    adminButtonStyles,
    adminLoadingStyles,
    fieldRowStyles,
    css`
      :host {
        display: block;
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
      }

      h3 {
        margin: 0 0 var(--space-2);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-md);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
      }

      .note {
        margin: 0 0 var(--space-6);
        max-width: 62ch;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .wahl {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-4);
        max-width: 620px;
      }

      .platte {
        display: grid;
        gap: var(--space-2);
        padding: var(--space-4);
        text-align: left;
        background: var(--color-surface-raised);
        border: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        color: inherit;
        font: inherit;
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      }

      .platte:hover:not([disabled]) {
        border-color: var(--color-primary);
      }

      .platte[aria-pressed='true'] {
        border-color: var(--color-primary);
        box-shadow: inset 0 -3px 0 var(--color-primary);
      }

      .platte:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .platte[disabled] {
        opacity: 0.6;
        cursor: default;
      }

      .platte__name {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
      }

      .platte__was {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }

      /*
       * Drei Streifen in den Grundfarben der jeweiligen Ausgabe.
       *
       * Sie koennen KEIN Token nehmen: ein Token zeigt immer nur die gerade
       * laufende Ausgabe, und diese Probe soll die ANDERE zeigen. Sie koennen
       * aber auch keine Hexwerte hier tragen — das waere eine zweite Kopie der
       * Palette, die beim ersten Nachschaerfen still auseinanderlaeuft und
       * ausserdem eine Ausnahme im Farbtor verlangte.
       *
       * Deshalb kommen die Werte zur Laufzeit aus PLATFORM_SKINS, also aus
       * genau der Konfiguration, die der Umschalter auch anwendet. Eine Probe,
       * die luegt, ist damit ausgeschlossen.
       */
      .probe {
        display: flex;
        block-size: 28px;
        border: var(--border-width-thin) solid var(--color-border);
      }

      .probe span {
        flex: 1;
      }

      .jetzt {
        margin-top: var(--space-6);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }
    `,
  ];

  @state() private _skin: PlatformSkin = FALLBACK;
  @state() private _loading = true;
  @state() private _saving = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    try {
      const result = await adminApi.listSettings();
      if (result.success && result.data) {
        const row = (result.data as PlatformSetting[]).find(
          (r) => r.setting_key === KEY_DEFAULT_SKIN,
        );
        /*
         * Der Wert kommt je nach Schreibweg als '"dark"' (jsonb aus einer
         * Migration) oder als dark (ueber updateSetting). Die
         * Anfuehrungszeichen abzuschneiden ist deshalb keine Kosmetik: ohne
         * das faellt jede von einer Migration gesetzte Ausgabe durch den
         * Waechter und die Seite zeigte immer Phosphor als gewaehlt an.
         */
        const roh = String(row?.setting_value ?? '')
          .trim()
          .replace(/^"|"$/g, '');
        this._skin = isPlatformSkin(roh) ? roh : FALLBACK;
      }
    } catch (err) {
      captureError(err, { source: 'VelgAdminAppearanceTab._load' });
    }
    this._loading = false;
  }

  private async _waehle(skin: PlatformSkin): Promise<void> {
    if (skin === this._skin || this._saving) return;
    this._saving = true;
    try {
      const result = await adminApi.updateSetting(KEY_DEFAULT_SKIN, skin);
      if (result.success) {
        this._skin = skin;
        /*
         * Die eigene Erinnerung mitziehen. Ohne das bekaeme ausgerechnet die
         * Person, die die Vorgabe gerade gesetzt hat, sie erst beim
         * uebernaechsten Aufruf zu sehen — der Abruf beim Start hat laengst
         * stattgefunden. Wer selbst gewaehlt hat, behaelt seine Wahl: das
         * entscheidet applyDefaultSkin, nicht diese Stelle.
         */
        appState.applyDefaultSkin(skin);
        VelgToast.success(msg('Default edition saved.'));
      } else {
        VelgToast.error(result.error?.message ?? msg('Save failed.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgAdminAppearanceTab._waehle' });
      VelgToast.error(msg('Save failed.'));
    }
    this._saving = false;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state
        .message=${msg('Reading the appearance setting')}
      ></velg-loading-state>`;
    }

    return html`
      <h3>${msg('Default edition')}</h3>
      <p class="note">
        ${msg(
          'Which edition someone sees who has not chosen one: every guest, every new account, every fresh browser. A reader who picks an edition in the header keeps it – this setting never overrides a choice already made.',
        )}
      </p>

      <div class="wahl" role="group" aria-label=${msg('Default edition')}>
        ${this._renderPlatte(
          'dark',
          msg('Phosphor'),
          msg('The terminal chrome: near-black ground, amber accent.'),
        )}
        ${this._renderPlatte(
          'atlas',
          msg('Paper'),
          msg('The map folio: survey paper, ink, vermilion.'),
        )}
      </div>

      <p class="jetzt">
        ${
          this._skin === 'atlas'
            ? msg('Guests currently start on Paper.')
            : msg('Guests currently start on Phosphor.')
        }
      </p>
    `;
  }

  private _renderPlatte(skin: PlatformSkin, name: string, was: string) {
    return html`
      <button
        class="platte"
        aria-pressed=${String(this._skin === skin)}
        ?disabled=${this._saving}
        @click=${() => this._waehle(skin)}
      >
        <span class="probe" aria-hidden="true">
          ${probeFarben(skin).map((farbe) => html`<span style="background:${farbe}"></span>`)}
        </span>
        <span class="platte__name">${name}</span>
        <span class="platte__was">${was}</span>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-appearance-tab': VelgAdminAppearanceTab;
  }
}
