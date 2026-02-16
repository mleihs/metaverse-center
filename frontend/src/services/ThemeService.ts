/**
 * ThemeService — Loads simulation design settings and injects them
 * as CSS Custom Properties on :root[data-simulation].
 *
 * Design settings use keys like:
 *   design.colors.primary       -> --sim-color-primary
 *   design.colors.background    -> --sim-color-background
 *   design.typography.font_family -> --sim-font-family
 *   design.custom_css           -> injected via a <style> element
 */

import type { SimulationSetting } from '../types/index.js';
import { settingsApi } from './api/index.js';

/** Maximum allowed size for custom CSS (bytes). */
const MAX_CUSTOM_CSS_BYTES = 10_240;

/** ID of the injected <style> element for custom CSS. */
const CUSTOM_STYLE_ID = 'velg-simulation-custom-css';

/** Prefix applied to all generated CSS custom properties. */
const CSS_VAR_PREFIX = '--sim-';

class ThemeService {
  private styleElement: HTMLStyleElement | null = null;

  /**
   * Load design settings for the given simulation and apply them
   * as CSS custom properties on document.documentElement.
   */
  async applySimulationTheme(simulationId: string): Promise<void> {
    const response = await settingsApi.getByCategory(simulationId, 'design');

    if (!response.success || !response.data) {
      console.warn('[ThemeService] Failed to load design settings:', response.error?.message);
      return;
    }

    const settings = response.data;

    // Mark the root element with the active simulation id
    document.documentElement.dataset.simulation = simulationId;

    for (const setting of settings) {
      this.applySetting(setting);
    }
  }

  /** Remove all simulation-specific CSS custom properties and clean up. */
  resetTheme(): void {
    const root = document.documentElement;

    // Remove all --sim-* custom properties
    const style = root.style;
    const propsToRemove: string[] = [];
    for (let i = 0; i < style.length; i++) {
      const prop = style.item(i);
      if (prop.startsWith(CSS_VAR_PREFIX)) {
        propsToRemove.push(prop);
      }
    }
    for (const prop of propsToRemove) {
      style.removeProperty(prop);
    }

    // Remove data-simulation attribute
    delete root.dataset.simulation;

    // Remove injected custom CSS <style> element
    this.removeCustomStyleElement();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Route a single SimulationSetting to the correct handler based on its
   * setting_key prefix.
   */
  private applySetting(setting: SimulationSetting): void {
    const { setting_key, setting_value } = setting;

    if (setting_key === 'design.custom_css') {
      this.injectCustomCSS(String(setting_value ?? ''));
      return;
    }

    if (setting_key === 'design.logo_url') {
      // logo_url is not a CSS property — skip for now
      return;
    }

    const cssVarName = this.settingKeyToCSSVar(setting_key);
    if (cssVarName) {
      document.documentElement.style.setProperty(cssVarName, String(setting_value));
    }
  }

  /**
   * Convert a setting_key like `design.colors.primary_hover` into a CSS
   * custom property name like `--sim-color-primary-hover`.
   *
   * Mapping rules:
   *   design.colors.X      -> --sim-color-X   (underscores become hyphens)
   *   design.typography.X   -> --sim-X         (underscores become hyphens)
   *
   * Returns null for keys that do not map to a CSS variable.
   */
  private settingKeyToCSSVar(key: string): string | null {
    // design.colors.primary_hover -> color-primary-hover
    if (key.startsWith('design.colors.')) {
      const colorName = key.slice('design.colors.'.length).replace(/_/g, '-');
      return `${CSS_VAR_PREFIX}color-${colorName}`;
    }

    // design.typography.font_family -> font-family
    if (key.startsWith('design.typography.')) {
      const typoPart = key.slice('design.typography.'.length).replace(/_/g, '-');
      return `${CSS_VAR_PREFIX}${typoPart}`;
    }

    // Unknown design key — ignore
    return null;
  }

  /**
   * Inject custom CSS provided by the simulation owner.
   * The CSS is sanitized before insertion.
   */
  private injectCustomCSS(css: string): void {
    this.removeCustomStyleElement();

    const sanitized = this.sanitizeCSS(css);
    if (!sanitized) {
      return;
    }

    const style = document.createElement('style');
    style.id = CUSTOM_STYLE_ID;
    style.textContent = sanitized;
    document.head.appendChild(style);
    this.styleElement = style;
  }

  /** Remove the previously injected custom CSS <style> element if present. */
  private removeCustomStyleElement(): void {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
      return;
    }

    // Fallback: look up by id in case reference was lost
    const existing = document.getElementById(CUSTOM_STYLE_ID);
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Basic sanitization for user-provided CSS.
   *
   * Strips:
   *  - @import rules (potential data exfiltration)
   *  - javascript: URIs
   *  - expression() (legacy IE vector)
   *  - -moz-binding (Firefox XBL vector)
   *  - behavior: (IE HTC vector)
   *
   * Enforces a maximum of MAX_CUSTOM_CSS_BYTES.
   * Returns the sanitized string, or an empty string if it exceeds the limit.
   */
  private sanitizeCSS(css: string): string {
    if (!css || typeof css !== 'string') {
      return '';
    }

    // Enforce size limit
    if (new Blob([css]).size > MAX_CUSTOM_CSS_BYTES) {
      console.warn('[ThemeService] Custom CSS exceeds 10 KB limit — skipping.');
      return '';
    }

    let sanitized = css;

    // Strip @import
    sanitized = sanitized.replace(/@import\s+[^;]+;?/gi, '/* @import removed */');

    // Strip javascript: URIs
    sanitized = sanitized.replace(/javascript\s*:/gi, '/* javascript: removed */');

    // Strip expression()
    sanitized = sanitized.replace(/expression\s*\(/gi, '/* expression( removed */');

    // Strip -moz-binding
    sanitized = sanitized.replace(/-moz-binding\s*:/gi, '/* -moz-binding removed */');

    // Strip behavior:
    sanitized = sanitized.replace(/behavior\s*:/gi, '/* behavior: removed */');

    return sanitized;
  }
}

export const themeService = new ThemeService();
