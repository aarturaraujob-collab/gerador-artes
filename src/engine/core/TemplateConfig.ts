export interface TemplateVariant {
  games: number;
  file: string;
}

export interface TemplateFieldConfig {
  /** Maximum rendered width, in SVG user units, before fitText shrinks the font. */
  maxWidth?: number;
  /** Smallest font-size fitText may shrink this field down to. */
  minFontSize?: number;
}

export interface TemplateConfig {
  id: string;
  name: string;
  variants: TemplateVariant[];
  /** Keyed by the base SVG id (without the `_2`, `_3`, ... slot suffix). */
  fields?: Record<string, TemplateFieldConfig>;
}

/** The distinct match-per-art sizes a template declares. */
export function variantSizes(config: TemplateConfig): number[] {
  return config.variants.map((variant) => variant.games);
}
