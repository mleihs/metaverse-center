/**
 * Theme configuration validation schema using Zod.
 *
 * Validates theme config values before applying to DOM or saving to backend.
 * All fields are optional — partial theme configs are valid (missing fields
 * keep the base token value).
 */

import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color (e.g. #0d7377)');

const cssLength = z
  .string()
  .regex(/^-?\d+(\.\d+)?(px|em|rem|%)$/, 'Must be a CSS length value (e.g. 6px, 0.05em)');

const fontStack = z.string().min(1, 'Font stack cannot be empty').max(200, 'Font stack too long');

const shadowStyle = z.enum(['offset', 'blur', 'glow', 'none']);
const hoverEffect = z.enum(['translate', 'scale', 'glow']);
const textTransform = z.enum(['uppercase', 'capitalize', 'none']);

export const themeConfigSchema = z.object({
  // Tier 1: Colors
  color_primary: hexColor.optional(),
  color_primary_hover: hexColor.optional(),
  color_primary_active: hexColor.optional(),
  color_secondary: hexColor.optional(),
  color_accent: hexColor.optional(),
  color_background: hexColor.optional(),
  color_surface: hexColor.optional(),
  color_surface_sunken: hexColor.optional(),
  color_surface_header: hexColor.optional(),
  color_text: hexColor.optional(),
  color_text_secondary: hexColor.optional(),
  color_text_muted: hexColor.optional(),
  color_border: hexColor.optional(),
  color_border_light: hexColor.optional(),
  color_danger: hexColor.optional(),
  color_success: hexColor.optional(),
  color_primary_bg: hexColor.optional(),
  color_info_bg: hexColor.optional(),
  color_danger_bg: hexColor.optional(),
  color_success_bg: hexColor.optional(),
  color_warning_bg: hexColor.optional(),

  // Tier 2: Typography
  font_heading: fontStack.optional(),
  font_body: fontStack.optional(),
  font_mono: fontStack.optional(),
  heading_weight: z
    .string()
    .regex(/^[1-9]00$/, 'Must be a font weight (100-900)')
    .optional(),
  heading_transform: textTransform.optional(),
  heading_tracking: cssLength.optional(),
  font_base_size: cssLength.optional(),

  // Tier 3: Character
  border_radius: cssLength.optional(),
  border_width: cssLength.optional(),
  border_width_default: cssLength.optional(),
  shadow_style: shadowStyle.optional(),
  shadow_color: hexColor.optional(),
  hover_effect: hoverEffect.optional(),
  animation_speed: z
    .string()
    .refine((v) => {
      const n = Number.parseFloat(v);
      return !Number.isNaN(n) && n >= 0.5 && n <= 2.0;
    }, 'Must be a number between 0.5 and 2.0')
    .optional(),
  animation_easing: z.string().max(100).optional(),
  text_inverse: hexColor.optional(),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

/**
 * Validate a partial theme config. Returns the parsed config on success,
 * or null with logged warnings on failure.
 */
export function validateThemeConfig(config: Record<string, string>): ThemeConfig | null {
  const result = themeConfigSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }
  console.warn(
    '[ThemeValidation] Invalid theme config:',
    result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  );
  return null;
}

/** All known theme setting keys. */
export const THEME_SETTING_KEYS = Object.keys(themeConfigSchema.shape) as (keyof ThemeConfig)[];
