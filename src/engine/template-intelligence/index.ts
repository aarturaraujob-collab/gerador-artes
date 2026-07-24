/**
 * Barrel — the only door into template introspection (CP6). Other modules
 * import from here, never from SvgTemplateAnalyzer/TemplateValidator
 * directly, so nothing outside this folder needs to know an SVG's structure
 * is read via DOMParser.
 */
export { TemplateLoader } from "./TemplateLoader";
export type { LoadedTemplate, TemplateLoaderOptions } from "./TemplateLoader";
export type {
  SvgFieldType,
  TemplateSlot,
  TemplateField,
  TemplateCategory,
  TemplateDimensions,
  TemplateMetadata,
  ValidationSeverity,
  ValidationCategory,
  ValidationIssue,
  ValidationReport,
} from "./types";
