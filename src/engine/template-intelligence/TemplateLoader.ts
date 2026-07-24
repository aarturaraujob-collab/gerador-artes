import { analyzeSvgTemplate } from "./SvgTemplateAnalyzer";
import { validateTemplate } from "./TemplateValidator";
import type { TemplateDimensions, TemplateField, TemplateMetadata, ValidationReport } from "./types";
import type { TemplateConfig } from "@/engine/core/TemplateConfig";

export interface LoadedTemplate {
  dimensions: TemplateDimensions;
  textFields: TemplateField[];
  imageFields: TemplateField[];
  backgrounds: TemplateField[];
  groups: TemplateField[];
  /** CP3 — the summarized metadata object the rest of the system consumes. */
  metadata: TemplateMetadata;
  /** CP4 — everything wrong (or worth flagging) about this SVG, found on load. */
  validation: ValidationReport;
}

export interface TemplateLoaderOptions {
  /** Cross-checks the SVG against an already-authored config.json, flagging fields it declares that don't exist in this file. */
  config?: TemplateConfig;
}

/**
 * The single public entry point for template introspection (CP6). Every
 * other module should go through here — none of them need to know this is
 * backed by DOMParser, or how the txt_/img_/grp_ convention is matched.
 *
 * Read-only end to end: the SVG text handed in is never mutated or
 * re-serialized. TemplateLoader only ever computes and returns metadata
 * about it — the SVG file itself stays the single source of truth (never a
 * proprietary derived format), matching the sprint's "Illustrator/Inkscape
 * compatible" requirement.
 */
export class TemplateLoader {
  static load(svg: string, options: TemplateLoaderOptions = {}): LoadedTemplate {
    const analyzed = analyzeSvgTemplate(svg);
    const validation = validateTemplate(analyzed.document, options);

    const textFields = [...analyzed.fieldsByType.get("text")!.values()];
    const imageFields = [...analyzed.fieldsByType.get("image")!.values()];
    const groups = [...analyzed.fieldsByType.get("group")!.values()];

    const metadata: TemplateMetadata = {
      dimensions: analyzed.dimensions,
      category: analyzed.category,
      fields: textFields.map((field) => field.baseId),
      images: imageFields.map((field) => field.baseId),
      placeholders: analyzed.placeholders,
      unrecognized: analyzed.unrecognized,
    };

    return {
      dimensions: analyzed.dimensions,
      textFields,
      imageFields,
      backgrounds: analyzed.backgrounds,
      groups,
      metadata,
      validation,
    };
  }
}
