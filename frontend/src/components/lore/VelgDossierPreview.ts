import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { agentsApi, buildingsApi } from '../../services/api/index.js';
import { locationsApi } from '../../services/api/LocationsApiService.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';

interface PreviewSlot {
  arcanum: string;
  label: string;
  teaser: string;
}

/**
 * Redacted preview of the 6 classified dossier sections.
 * Shows real entity names interpolated into redacted teaser templates
 * to create intrigue before purchase.
 */
@localized()
@customElement('velg-dossier-preview')
export class VelgDossierPreview extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin-top: var(--space-6);
    }

    .preview {
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 25%, transparent);
      background: color-mix(in srgb, var(--color-surface-sunken) 60%, transparent);
      padding: var(--space-5);
      position: relative;
      overflow: hidden;
    }

    /* Subtle scanline overlay */
    .preview::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(245, 158, 11, 0.02) 2px,
        rgba(245, 158, 11, 0.02) 4px
      );
      pointer-events: none;
    }

    .preview__header {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid color-mix(in srgb, var(--color-accent-amber) 20%, transparent);
    }

    .preview__slots {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .slot {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-surface) 50%, transparent);
      opacity: 0;
      transform: translateX(-6px);
      animation: slot-reveal 400ms ease-out forwards;
    }

    @keyframes slot-reveal {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .slot__icon {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      padding-top: 2px;
      color: var(--color-accent-amber);
      opacity: 0.7;
    }

    .slot__content {
      flex: 1;
      min-width: 0;
    }

    .slot__label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-1);
    }

    .slot__teaser {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      line-height: 1.6;
      color: var(--color-text-quiet);
    }

    .redacted {
      background: var(--color-text-muted);
      color: transparent;
      user-select: none;
      padding: 0 2px;
      border-radius: 1px;
    }

    .entity-name {
      color: var(--color-text-secondary);
      font-weight: 600;
    }

    .classified-marker {
      font-weight: 700;
      color: color-mix(in srgb, var(--color-accent-amber) 60%, var(--color-text-muted));
    }

    @media (prefers-reduced-motion: reduce) {
      .slot {
        animation: none;
        opacity: 1;
        transform: none;
      }
    }

    @media (max-width: 480px) {
      .preview {
        padding: var(--space-3);
      }

      .slot {
        padding: var(--space-2);
      }
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _agentNames: string[] = [];
  @state() private _buildingNames: string[] = [];
  @state() private _zoneNames: string[] = [];
  @state() private _loaded = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this._loadEntityNames();
  }

  private async _loadEntityNames(): Promise<void> {
    if (!this.simulationId) return;

    try {
      // Dossier preview is public-facing (redacted teaser) — use public
      // endpoints throughout so signed-out and non-member visitors both see
      // the same preview without 403s on the authenticated endpoint.
      const [agentsResp, buildingsResp, zonesResp] = await Promise.allSettled([
        agentsApi.listPublic(this.simulationId),
        buildingsApi.listPublic(this.simulationId),
        locationsApi.listZones(this.simulationId, 'public'),
      ]);

      if (agentsResp.status === 'fulfilled' && agentsResp.value.data) {
        this._agentNames = agentsResp.value.data
          .slice(0, 6)
          .map((a) => a.name)
          .filter(Boolean);
      }
      if (buildingsResp.status === 'fulfilled' && buildingsResp.value.data) {
        this._buildingNames = buildingsResp.value.data
          .slice(0, 4)
          .map((b) => b.name)
          .filter(Boolean);
      }
      if (zonesResp.status === 'fulfilled' && zonesResp.value.data) {
        this._zoneNames = zonesResp.value.data
          .slice(0, 4)
          .map((z) => z.name)
          .filter(Boolean);
      }
    } catch (err) {
      // Preview renders with redacted fallback text when names can't be fetched.
      captureError(err, { source: 'VelgDossierPreview._loadEntityNames' });
    }

    this._loaded = true;
  }

  private _getSlots(): PreviewSlot[] {
    const agent = this._agentNames[0] ?? '████████';
    const agent2 = this._agentNames[1] ?? '████████';
    const building = this._buildingNames[0] ?? '████████';
    const building2 = this._buildingNames[1] ?? '████████';
    const zone = this._zoneNames[0] ?? '████████';

    /*
     * EINE Uebersetzungseinheit je Satz, nicht sechs.
     *
     * Die vorige Fassung klebte jeden Teaser aus msg()-Bruchstuecken zusammen:
     * `${msg('… recovered near')} ${zone} ${msg('suggests')} ████`. Jedes
     * Bruchstueck wurde einzeln uebersetzt, und was auf der Seite stand, war
     *
     *     „Geborgene archaeologische Beweise DEUTEN AUF Bleichgrund DEUTEN AUF ████“
     *
     * weil „recovered near" und „suggests" beide auf „deuten auf" fielen. Das
     * ist kein Uebersetzungsfehler: aus englischen Bruchkanten laesst sich
     * deutsche Wortstellung nicht erzeugen, und der Uebersetzer sieht nie den
     * Satz, den er baut. Zwei Faelle waren noch schaerfer — `msg('the')` und
     * `msg('shall')` standen als einzelne Woerter da, ohne Genus und ohne
     * Verbstellung.
     *
     * `msg(str`…`)` haelt den Satz zusammen und legt die eingesetzten Werte als
     * Platzhalter ins XLIFF, die ein Uebersetzer UMSTELLEN kann. Die Woerter,
     * die selbst uebersetzt gehoeren, werden vorher aufgeloest und als Wert
     * eingesetzt — dadurch bleiben sie Uebersetzungseinheiten, ohne den Satz zu
     * zerschneiden.
     */
    const geschwaerzt = msg('REDACTED');
    const geheim = msg('CLASSIFIED');

    return [
      {
        arcanum: 'ALPHA',
        label: msg('Pre-Arrival History (~2,000 words)'),
        teaser: msg(
          str`What existed before this shard materialized? Competing theories from Bureau historians. Archaeological evidence recovered near ${zone} suggests ████████. Temporal anomalies, contested origin myths, and the [${geschwaerzt}] incident of ████████.`,
        ),
      },
      {
        arcanum: 'BETA',
        label: msg('Agent Classified Addenda (~2,500 words)'),
        teaser: msg(
          str`Per-agent intelligence supplement. ${agent}: RISK ASSESSMENT ████████, HIDDEN MOTIVATION: [${geheim}], SURVEILLANCE NOTES... // ${agent2}: [${geschwaerzt}] // Full dossier for every agent. Cross-references mapped.`,
        ),
      },
      {
        arcanum: 'GAMMA',
        label: msg('Geographic Anomalies (~1,500 words)'),
        teaser: msg(
          str`Cartographic breach detected near ${building}. Spatial geometry contradicts ████ Bureau field surveys. ${building2} exhibits properties consistent with ███████. Annotated zone analysis for ${zone}.`,
        ),
      },
      {
        arcanum: 'DELTA',
        label: msg('Bleed Signature Analysis (~1,500 words)'),
        teaser: msg(
          str`Cross-shard contamination vectors. Which adjacent realities bleed into this shard and why. CONTAINMENT STATUS: ████████ | DOCUMENTED INCURSIONS: [${geschwaerzt}]`,
        ),
      },
      {
        arcanum: 'EPSILON',
        label: msg('Prophetic Fragments (~1,000 words)'),
        teaser: msg(
          str`Recovered documents, dream transcriptions, inscriptions. "the ${building} shall ████... [ILLEGIBLE]" – Source: ████████. Reliability: [CONSUMED]. Unreliable narration with degradation markers.`,
        ),
      },
      {
        arcanum: 'ZETA',
        label: msg('Bureau Recommendation (~500 words)'),
        teaser: msg(
          str`Official Bureau assessment. Threat designation, research value, recommended actions. THREAT LEVEL: ████████ | [${geheim}] | Institutional authority. Dry humor. Final word.`,
        ),
      },
    ];
  }

  protected render() {
    if (!this._loaded) return nothing;

    const slots = this._getSlots();

    return html`
      <div class="preview" role="list" aria-label=${msg('Dossier preview – 6 classified sections pending authorization')}>
        <div class="preview__header">
          ${msg('DOSSIER PREVIEW // 6 CLASSIFIED SECTIONS PENDING AUTHORIZATION')}
        </div>
        <div class="preview__slots">
          ${slots.map(
            (slot, i) => html`
              <div
                class="slot"
                role="listitem"
                style="animation-delay: ${i * 80}ms"
              >
                <span class="slot__icon" aria-hidden="true">${icons.lock(14)}</span>
                <div class="slot__content">
                  <div class="slot__label">${msg('ARCANUM')} ${slot.arcanum} – ${slot.label}</div>
                  <div class="slot__teaser">${this._renderTeaser(slot.teaser)}</div>
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderTeaser(teaser: string) {
    // Parse teaser text, wrapping redaction blocks and entity names
    const parts: Array<ReturnType<typeof html>> = [];
    const regex = /(\[(?:REDACTED|CLASSIFIED|CONSUMED|ILLEGIBLE)\])|(████+|███████+)/g;
    let last = 0;

    for (const match of teaser.matchAll(regex)) {
      if (match.index > last) {
        parts.push(html`${teaser.slice(last, match.index)}`);
      }
      if (match[1]) {
        parts.push(html`<span class="classified-marker">${match[1]}</span>`);
      } else {
        parts.push(
          html`<span class="redacted" aria-label=${msg('Redacted text')}>${match[2]}</span>`,
        );
      }
      last = match.index + match[0].length;
    }
    if (last < teaser.length) {
      parts.push(html`${teaser.slice(last)}`);
    }
    return parts;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dossier-preview': VelgDossierPreview;
  }
}
