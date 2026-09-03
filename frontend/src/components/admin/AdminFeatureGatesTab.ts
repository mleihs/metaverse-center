/**
 * AdminFeatureGatesTab -- jeder Plattform-Schalter an einem Ort, erklaert.
 *
 * Bis zum 31.08.2026 gab es fuer `platform_settings`-Schalter ueberhaupt keine
 * Oberflaeche. Fuenf Tore hatten einen Schalter irgendwo in einem Fachreiter
 * (Herzschlag, Instagram-Chiffre, Bluesky, Gesundheit, Waisen-Kehrer), fuenfzehn
 * hatten gar keinen. Deshalb steht `journal_enabled` auf Prod bis heute ohne
 * Zeile, und deshalb liess sich weder der DRIFT-Spielkern noch das Substrat
 * anschalten -- vier der sechs auf der Frontseite beworbenen Systeme.
 *
 * Der Abschnitt zeigt drei Dinge, die eine blosse Schalterliste verschweigen
 * wuerde:
 *
 *   1. FEHLT DIE ZEILE?  Eine fehlende Zeile bedeutet nicht ueberall dasselbe.
 *      Herzschlag, Autonomie und die Resonanzverarbeitung laufen ohne Zeile
 *      WEITER (Notaus-Schalter), das Journal bleibt aus (Anschalter). Ohne die
 *      Angabe ist ein leeres Feld zweideutig - genau daran ist `journal_enabled`
 *      monatelang unbemerkt vorbeigegangen.
 *   2. IST DER SCHALTER ANGESCHLOSSEN?  Fuenf DRIFT-Tore stehen als Zeile auf
 *      Prod, werden aber von nichts gelesen (gemessen am 31.08.2026 ueber
 *      `pg_get_functiondef` auf der laufenden Datenbank). Sie bleiben bedienbar
 *      - die Zeile ist echt -, aber sie sagen, dass sie nichts bewirken.
 *   3. WAS IST UNERKLAERT?  Jede `*_enabled`-Zeile ohne Eintrag im Vertrag
 *      erscheint am Ende als Warnung. So kann sich kein Schluessel dadurch
 *      verstecken, dass niemand ihn aufgeschrieben hat.
 *
 * Die Erklaerungen kommen aus `backend/services/platform_gate_contracts.py`,
 * nicht aus diesem Client: die Namen werden im Ruecken gelesen, also gehoert
 * die Erklaerung dorthin, wo ein AST-Test sie an ihre Lesestelle bindet.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import type { FeatureGate, FeatureGateList, UndeclaredGate } from '../../types/index.js';
import { adminButtonStyles, adminLoadingStyles } from '../shared/admin-shared-styles.js';
import { markerCornerStyles, markerStatusStyles } from '../shared/marker-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgToggle.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';

@localized()
@customElement('velg-admin-feature-gates-tab')
export class VelgAdminFeatureGatesTab extends LitElement {
  static styles = [
    adminButtonStyles,
    adminLoadingStyles,
    markerCornerStyles,
    markerStatusStyles,
    css`
      :host {
        /* Tier 3: alles abgeleitet, kein eigener Farbwert. */
        --_rule: var(--color-border-light);
        --_gap-note: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface));
        --_gap-edge: color-mix(in srgb, var(--color-warning) 34%, transparent);
        --_dead-note: color-mix(in srgb, var(--color-text-muted) 6%, var(--color-surface));

        display: block;
        color: var(--color-text-primary);
      }

      .intro {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
        max-width: 78ch;
        margin: 0 0 var(--space-6);
      }

      .group {
        margin-bottom: var(--space-8);
      }

      .group__head {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
        padding-bottom: var(--space-2);
        border-bottom: var(--border-width-thin) solid var(--_rule);
      }

      .group__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-brutalist);
        text-transform: var(--label-transform);
        color: var(--color-accent-amber);
        margin: 0;
      }

      .group__count {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-quiet);
      }

      /* Eine Sprosse pro Tor. Grid statt flex, damit der Schalter aller
         Zeilen auf derselben Spalte sitzt, egal wie lang der Text ist. */
      .gate {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--space-4);
        align-items: start;
        padding: var(--space-4) var(--space-3);
        border-bottom: var(--border-width-thin) solid var(--_rule);
        opacity: 0;
        animation: gate-in var(--duration-entrance) var(--ease-dramatic) forwards;
        animation-delay: calc(var(--i, 0) * var(--duration-stagger));
      }

      @keyframes gate-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      .gate:last-child {
        border-bottom: none;
      }

      .gate--gap {
        background: var(--_gap-note);
        border: var(--border-width-thin) solid var(--_gap-edge);
        padding: var(--space-4);
      }

      .gate--dead {
        background: var(--_dead-note);
      }

      .gate__label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-brutalist);
        text-transform: var(--label-transform);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-1);
      }

      .gate__key {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-quiet);
        word-break: break-all;
      }

      .gate__on,
      .gate__cost {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        margin: var(--space-2) 0 0;
        max-width: 70ch;
      }

      .gate__on {
        color: var(--color-text-secondary);
      }

      .gate__cost {
        color: var(--color-text-quiet);
      }

      .gate__cost strong {
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
      }

      .gate__reader {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-quiet);
        margin-top: var(--space-2);
        opacity: 0.75;
        word-break: break-all;
      }

      .gate__marks {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin-top: var(--space-2);
      }

      /* Rechte Spalte: Schalter plus die Zustandszeile darunter. */
      .gate__control {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-2);
        min-width: 132px;
      }

      .gate__state {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: var(--label-transform);
        color: var(--color-text-quiet);
        white-space: nowrap;
      }

      .gate__state--on {
        color: var(--color-accent-green);
      }

      .undeclared {
        margin-top: var(--space-10);
        padding: var(--space-5);
        border: var(--border-width-thin) dashed var(--color-border-danger);
        background: var(--color-danger-bg);
      }

      .undeclared__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-brutalist);
        text-transform: var(--label-transform);
        color: var(--color-danger);
        margin: 0 0 var(--space-2);
      }

      .undeclared__hint {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
        margin: 0 0 var(--space-3);
        max-width: 78ch;
      }

      .undeclared__row {
        display: flex;
        justify-content: space-between;
        gap: var(--space-4);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-primary);
        padding: var(--space-1) 0;
      }

      .summary {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-5);
        padding: var(--space-4);
        margin-bottom: var(--space-6);
      }

      .summary__item {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .summary__value {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-lg);
        color: var(--color-text-primary);
      }

      .summary__label {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: var(--label-transform);
        color: var(--color-text-quiet);
      }

      @media (max-width: 640px) {
        .gate {
          grid-template-columns: 1fr;
        }

        .gate__control {
          align-items: flex-start;
          min-width: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .gate {
          opacity: 1;
          animation: none;
        }
      }
    `,
  ];

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _data: FeatureGateList | null = null;
  @state() private _saving: string | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    const result = await adminApi.listFeatureGates();
    if (result.success && result.data) {
      this._data = result.data;
    } else {
      this._error = result.error?.message ?? msg('Feature gates could not be loaded.');
    }
    this._loading = false;
  }

  /**
   * Schreibt den kanonischen Kleinbuchstaben-Wert.
   *
   * `parse_setting_bool` ist seit F32 ein Positivabgleich auf
   * `{true, 1, yes, on}` - alles andere ist AUS. Deshalb hier nie einen
   * anderen Text schreiben als 'true' / 'false'.
   */
  private async _toggle(gate: FeatureGate, next: boolean): Promise<void> {
    this._saving = gate.key;
    try {
      const result = await adminApi.updateSetting(gate.key, next ? 'true' : 'false');
      if (result.success) {
        this._data = this._data && {
          ...this._data,
          gates: this._data.gates.map((g) =>
            g.key === gate.key
              ? { ...g, enabled: next, has_row: true, raw_value: String(next) }
              : g,
          ),
        };
        VelgToast.success(
          next ? msg(str`${gate.label} is now on.`) : msg(str`${gate.label} is now off.`),
        );
      } else {
        VelgToast.error(result.error?.message ?? msg('Save failed.'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminFeatureGatesTab._toggle' });
      VelgToast.error(msg('Save failed.'));
    } finally {
      this._saving = null;
    }
  }

  private _groupTitle(group: string): string {
    switch (group) {
      case 'world':
        return msg('World');
      case 'narrative':
        return msg('Narrative layers');
      case 'drift':
        return msg('DRIFT');
      case 'social':
        return msg('Social channels');
      case 'operations':
        return msg('Operations');
      default:
        return group;
    }
  }

  /**
   * Die Zeile, die eine blosse Schalterliste verschweigt.
   *
   * Ohne Zeile in der Tabelle ist der wirksame Zustand die Vorgabe der
   * Lesestelle - und die ist bei Notaus-Schaltern AN. Das muss dastehen,
   * sonst liest man ein leeres Feld als "aus".
   */
  private _renderMarks(gate: FeatureGate) {
    const marks = [];

    if (!gate.has_row) {
      marks.push(
        gate.default_when_missing
          ? html`<span class="status-mark status-mark--warning"
              >${msg('No row - runs anyway (default on)')}</span
            >`
          : html`<span class="status-mark status-mark--warning"
              >${msg('No row - therefore off')}</span
            >`,
      );
    }

    if (!gate.wired) {
      marks.push(
        html`<span class="status-mark status-mark--muted"
          >${msg('Prepared - nothing reads this switch')}</span
        >`,
      );
    }

    if (gate.has_row && gate.raw_value !== null && !this._isCanonical(gate.raw_value)) {
      marks.push(
        html`<span class="status-mark status-mark--danger"
          >${msg(str`Non-canonical value: ${gate.raw_value}`)}</span
        >`,
      );
    }

    return marks.length ? html`<div class="gate__marks">${marks}</div>` : null;
  }

  /**
   * `parse_setting_bool` (F32) kennt nur `{true, 1, yes, on}` als AN. Alles
   * andere ist AUS - auch ein `"enabled"` oder ein `"True "` mit Leerzeichen.
   * Ein Wert ausserhalb der beiden kanonischen Formen ist deshalb kein
   * Schoenheitsfehler, sondern eine Falle.
   */
  private _isCanonical(raw: string): boolean {
    return raw.trim().toLowerCase() === 'true' || raw.trim().toLowerCase() === 'false';
  }

  private _renderGate(gate: FeatureGate, index: number) {
    const classes = ['gate', !gate.has_row ? 'gate--gap' : '', !gate.wired ? 'gate--dead' : '']
      .filter(Boolean)
      .join(' ');

    return html`
      <div class=${classes} style="--i: ${index}">
        <div>
          <h4 class="gate__label">${gate.label}</h4>
          <span class="gate__key">${gate.key}</span>
          <p class="gate__on">${gate.turns_on}</p>
          <p class="gate__cost">
            <strong>${msg('Off:')}</strong>
            ${gate.absence_costs}
          </p>
          ${this._renderMarks(gate)}
          <div class="gate__reader">${gate.reader}</div>
        </div>
        <div class="gate__control">
          <velg-toggle
            variant="scif"
            .checked=${gate.enabled}
            ?disabled=${this._saving === gate.key}
            label=${gate.label}
            @toggle-change=${(e: CustomEvent) => this._toggle(gate, e.detail.checked)}
          ></velg-toggle>
          <span class="gate__state ${gate.enabled ? 'gate__state--on' : ''}">
            ${gate.enabled ? msg('ON') : msg('OFF')}
          </span>
        </div>
      </div>
    `;
  }

  private _renderUndeclared(rows: UndeclaredGate[]) {
    if (!rows.length) return null;
    return html`
      <section class="undeclared">
        <h3 class="undeclared__title">${msg('Undeclared switches')}</h3>
        <p class="undeclared__hint">
          ${msg(
            'These rows end in _enabled but have no entry in the gate contract. Either they belong on this screen - then declare them in backend/services/platform_gate_contracts.py with one sentence on what they turn on and what their absence costs - or the row is a leftover and should go.',
          )}
        </p>
        ${rows.map(
          (row) => html`
            <div class="undeclared__row">
              <span>${row.key}</span>
              <span>${row.enabled ? msg('ON') : msg('OFF')}</span>
            </div>
          `,
        )}
      </section>
    `;
  }

  private _renderSummary(gates: FeatureGate[]) {
    const on = gates.filter((g) => g.enabled).length;
    const missing = gates.filter((g) => !g.has_row).length;
    const dead = gates.filter((g) => !g.wired).length;

    return html`
      <div class="summary marker-corners">
        <div class="summary__item">
          <span class="summary__value">${on} / ${gates.length}</span>
          <span class="summary__label">${msg('On')}</span>
        </div>
        <div class="summary__item">
          <span class="summary__value">${missing}</span>
          <span class="summary__label">${msg('Without a row')}</span>
        </div>
        <div class="summary__item">
          <span class="summary__value">${dead}</span>
          <span class="summary__label">${msg('Not wired')}</span>
        </div>
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state
        message=${msg('Loading feature gates...')}
      ></velg-loading-state>`;
    }

    if (this._error || !this._data) {
      return html`<velg-error-state
        message=${this._error ?? msg('Feature gates could not be loaded.')}
        show-retry
        @retry=${this._load}
      ></velg-error-state>`;
    }

    const { gates, groups, undeclared } = this._data;
    let index = 0;

    return html`
      <p class="intro">
        ${msg(
          'Every platform switch in one place. A switch nobody lists never gets flipped - that is why the journal stayed empty for months. Two things a plain list would hide are named here: whether a row exists at all (an absent row does not mean the same thing everywhere), and whether anything actually reads the switch.',
        )}
      </p>

      ${this._renderSummary(gates)}
      ${groups.map((group) => {
        const rows = gates.filter((g) => g.group === group);
        if (!rows.length) return null;
        return html`
          <section class="group">
            <div class="group__head">
              <h3 class="group__title">${this._groupTitle(group)}</h3>
              <span class="group__count">${rows.length}</span>
            </div>
            ${rows.map((gate) => this._renderGate(gate, index++))}
          </section>
        `;
      })}
      ${this._renderUndeclared(undeclared)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-feature-gates-tab': VelgAdminFeatureGatesTab;
  }
}
