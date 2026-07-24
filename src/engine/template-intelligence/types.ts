/** Every shape TemplateLoader's public API deals in — CP3/CP6. */

export type SvgFieldType = "text" | "image" | "group" | "shape";

export interface TemplateDimensions {
  width: number;
  height: number;
}

/** One slot of a field — a single numbered variant (`_2`, `_3`, ...) of a base id. */
export interface TemplateSlot {
  id: string;
  slotIndex: number;
  /** The real DOM node — kept for future work (CP7: visual editor, asset/color/font swapping). */
  element: Element;
}

/** One editable field the txt_/img_/grp_ convention recognizes — one entry per base id, with every slot it has. */
export interface TemplateField {
  baseId: string;
  type: SvgFieldType;
  slots: TemplateSlot[];
}

/** Best-effort guess from aspect ratio alone — TemplateLoader.load only ever sees the SVG text, never a folder/category. */
export type TemplateCategory = "quadrado" | "story" | "feed" | "outro";

export interface TemplateMetadata {
  dimensions: TemplateDimensions;
  category: TemplateCategory;
  /** Base ids of every recognized text field. */
  fields: string[];
  /** Base ids of every recognized image field (includes backgrounds and logos). */
  images: string[];
  /** Every raw id the txt_/img_/grp_ convention recognizes, slots included. */
  placeholders: string[];
  /** Ids present in the file that don't match the convention — design-tool export noise. */
  unrecognized: string[];
}

export type ValidationSeverity = "error" | "warning";

export type ValidationCategory =
  | "duplicate-id"
  | "invalid-element"
  | "missing-image"
  | "unidentified-text"
  | "missing-placeholder";

export interface ValidationIssue {
  severity: ValidationSeverity;
  category: ValidationCategory;
  message: string;
  elementId?: string;
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
