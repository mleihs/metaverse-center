/**
 * CSS custom-property resolution helper.
 *
 * Components that render into non-Lit surfaces (ECharts canvas, third-
 * party libraries expecting literal color strings) cannot pass
 * ``var(--token)`` through — the external renderer does not interpret
 * CSS variables. Read the computed value instead, once at build time,
 * so the output still follows the active theme preset.
 *
 * Returns an empty string when the property is unset or the host is not
 * yet attached to the DOM; callers should guard with ``if (value)`` or
 * provide their own default. Never returns ``undefined`` so ``||``
 * fallback chains behave predictably.
 */
export function readCssToken(host: Element, name: string): string {
  return getComputedStyle(host).getPropertyValue(name).trim();
}
