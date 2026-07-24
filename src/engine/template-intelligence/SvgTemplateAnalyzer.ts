import { classifyByIdPrefix, parseSlot } from "./svgIdConvention";
import type { SvgFieldType, TemplateCategory, TemplateDimensions, TemplateField, TemplateSlot } from "./types";

/** An id starting with "bg_"/"bg-" — the one bare (non txt_/img_/grp_) convention already in real templates (e.g. `bg_competicao`). */
const BG_PREFIX = /^bg[_-]/i;
const LOGO_HINT = /logo/i;

export interface AnalyzedTemplate {
  /** The parsed document — read-only from here on. Never mutated, never re-serialized: the SVG text is the only source of truth. */
  document: Document;
  dimensions: TemplateDimensions;
  category: TemplateCategory;
  fieldsByType: Map<SvgFieldType, Map<string, TemplateField>>;
  backgrounds: TemplateField[];
  logos: TemplateField[];
  placeholders: string[];
  unrecognized: string[];
}

function parseDimensions(svgRoot: Element): TemplateDimensions {
  const width = parseFloat(svgRoot.getAttribute("width") ?? "");
  const height = parseFloat(svgRoot.getAttribute("height") ?? "");
  if (Number.isFinite(width) && Number.isFinite(height)) return { width, height };

  const viewBox = svgRoot.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
      return { width: parts[2], height: parts[3] };
    }
  }
  return { width: 0, height: 0 };
}

/**
 * Best-effort guess from aspect ratio alone — TemplateLoader.load only ever
 * sees the SVG text, never an external folder/category, so this is purely
 * for standalone analysis of a not-yet-registered SVG. Never consulted by
 * any functional resolve/render path — format there comes exclusively from
 * config.json's explicit `variant.format` (CP6).
 *
 * This codebase's actual "feed" format is portrait (1080×1440, ratio 0.75),
 * not landscape — the boundary is inclusive so that ratio isn't silently
 * miscategorized as "outro".
 */
function guessCategory(dimensions: TemplateDimensions): TemplateCategory {
  if (!dimensions.width || !dimensions.height) return "outro";
  const ratio = dimensions.width / dimensions.height;
  if (ratio >= 0.9 && ratio <= 1.1) return "quadrado";
  if (ratio < 0.75) return "story";
  if (ratio <= 0.8) return "feed";
  return "outro";
}

function elementArea(element: Element): number {
  const width = parseFloat(element.getAttribute("width") ?? "");
  const height = parseFloat(element.getAttribute("height") ?? "");
  return Number.isFinite(width) && Number.isFinite(height) ? width * height : 0;
}

/**
 * Read-only structural analysis of a raw SVG string (CP1/CP2/CP3). Only ever
 * reads the parsed document — no mutation, no XMLSerializer — the SVG
 * remains the single source of truth throughout.
 */
export function analyzeSvgTemplate(svg: string): AnalyzedTemplate {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = document.documentElement;
  const dimensions = parseDimensions(root);
  const category = guessCategory(dimensions);

  const fieldsByType = new Map<SvgFieldType, Map<string, TemplateField>>([
    ["text", new Map()],
    ["image", new Map()],
    ["group", new Map()],
    ["shape", new Map()],
  ]);
  const placeholders: string[] = [];
  const unrecognized: string[] = [];
  const backgroundIds = new Set<string>();
  const logoIds = new Set<string>();

  for (const element of Array.from(root.querySelectorAll("[id]"))) {
    const id = element.getAttribute("id");
    if (!id) continue;

    const prefixType = classifyByIdPrefix(id);
    const looksLikeBackground = prefixType === "shape" && BG_PREFIX.test(id);
    const recognized = prefixType !== "shape" || looksLikeBackground;
    if (!recognized) {
      unrecognized.push(id);
      continue;
    }
    placeholders.push(id);

    // Bucketed purely by id prefix, matching SvgDocument.index() (the live
    // renderer) exactly — it never inspects the tag either. A prefix the
    // element's actual tag can't fulfil (e.g. txt_* on a <rect>) is a real
    // authoring mistake, but it's TemplateValidator's job to flag that, not
    // this analyzer's job to silently reclassify it.
    const type: SvgFieldType = prefixType;

    const { baseId, slotIndex } = parseSlot(id);
    const slot: TemplateSlot = { id, slotIndex, element };
    const bucket = fieldsByType.get(type)!;
    const field = bucket.get(baseId);
    if (field) field.slots.push(slot);
    else bucket.set(baseId, { baseId, type, slots: [slot] });

    if (LOGO_HINT.test(id)) logoIds.add(baseId);
    if (BG_PREFIX.test(id) || /background/i.test(id)) backgroundIds.add(baseId);
  }

  const imageFields = fieldsByType.get("image")!;
  const shapeFields = fieldsByType.get("shape")!;
  let backgrounds = [...backgroundIds]
    .map((baseId) => imageFields.get(baseId) ?? shapeFields.get(baseId))
    .filter((field): field is TemplateField => field !== undefined);

  // Geometric fallback: nothing was flagged as a background by id — the
  // largest-area image field is very likely the full-bleed background.
  if (backgrounds.length === 0) {
    let best: TemplateField | null = null;
    let bestArea = 0;
    for (const field of imageFields.values()) {
      for (const slot of field.slots) {
        const area = elementArea(slot.element);
        if (area > bestArea) {
          bestArea = area;
          best = field;
        }
      }
    }
    if (best) backgrounds = [best];
  }

  const logos = [...logoIds]
    .map((baseId) => imageFields.get(baseId))
    .filter((field): field is TemplateField => field !== undefined);

  return { document, dimensions, category, fieldsByType, backgrounds, logos, placeholders, unrecognized };
}
