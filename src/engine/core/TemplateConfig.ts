/** The art's aspect-ratio family. Omitted on legacy/single-format templates (e.g. thumb-faftv). */
export type TemplateFormat = "feed" | "story";

export interface TemplateVariant {
  games: number;
  file: string;
  format?: TemplateFormat;
}

/** Mirrors SVG's own `text-anchor` values — "start" is today's raw-replace behavior, unchanged. */
export type TextAlign = "start" | "middle" | "end";

export interface TemplateFieldConfig {
  /** Maximum rendered width, in SVG user units, before fitText shrinks the font. */
  maxWidth?: number;
  /** Smallest font-size fitText may shrink this field down to. */
  minFontSize?: number;
  /**
   * Horizontal alignment to preserve when the field's text changes length.
   * The SVGs have no native text-anchor, so this hint lets the engine derive
   * (fresh, from the template's own original placeholder, every render) the
   * anchor point a "middle"/"end"-aligned design intended. Omitted = "start".
   */
  align?: TextAlign;
}

export interface TemplateConfig {
  id: string;
  name: string;
  variants: TemplateVariant[];
  /** Keyed by the base SVG id (without the `_2`, `_3`, ... slot suffix). */
  fields?: Record<string, TemplateFieldConfig>;
}

/**
 * The distinct match-per-art sizes a template declares, optionally scoped to
 * one format. Omitting `format` returns every variant's size regardless of
 * format — today's exact behavior for templates with no format axis at all.
 */
export function variantSizes(config: TemplateConfig, format?: TemplateFormat): number[] {
  const variants = format ? config.variants.filter((variant) => variant.format === format) : config.variants;
  return variants.map((variant) => variant.games);
}

/** Every distinct format a template's variants declare, in variants order. Empty for legacy/single-format templates. */
export function availableFormats(config: TemplateConfig): TemplateFormat[] {
  return [...new Set(config.variants.map((variant) => variant.format).filter((format): format is TemplateFormat => Boolean(format)))];
}
