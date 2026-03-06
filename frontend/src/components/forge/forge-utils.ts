/**
 * Shared utilities for the Forge console components.
 * Extracted from duplicated implementations across forge phases.
 */
import { msg } from '@lit/localize';
import { html, type TemplateResult } from 'lit';

/**
 * Render a tooltip info bubble with descriptive text and an example.
 * Used by Astrolabe and Darkroom for form field annotations.
 * Requires `forgeInfoBubbleStyles` to be in the component's static styles.
 */
export function renderInfoBubble(text: string, example: string): TemplateResult {
  return html`
    <span class="info-bubble">
      <button class="info-bubble__trigger" type="button" aria-label=${msg('More info')}>i</button>
      <div class="info-bubble__panel">
        <p class="info-bubble__text">${text}</p>
        <p class="info-bubble__example">${example}</p>
      </div>
    </span>
  `;
}

/**
 * Calculate a fan-spread CSS transform for a card at a given index.
 * Cards spread outward from center with rotation and vertical offset.
 *
 * @param index - Card position in the array
 * @param total - Total number of cards
 * @param rotMultiplier - Degrees per position offset (default 12 for anchors, 10 for entity staging)
 * @param yMultiplier - Pixels per position offset (default 8 for anchors, 6 for entity staging)
 */
export function fanRotation(
  index: number,
  total: number,
  rotMultiplier = 12,
  yMultiplier = 8,
): string {
  const center = (total - 1) / 2;
  const rot = (index - center) * rotMultiplier;
  const y = Math.abs(index - center) * yMultiplier;
  return `rotateZ(${rot}deg) translateY(${y}px)`;
}
