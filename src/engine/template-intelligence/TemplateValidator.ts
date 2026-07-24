import { classifyByIdPrefix, parseSlot } from "./svgIdConvention";
import type { ValidationIssue, ValidationReport } from "./types";
import type { TemplateConfig } from "@/engine/core/TemplateConfig";

const TEXT_CAPABLE_TAGS = new Set(["text", "tspan"]);
/** <rect>/<g> can host a pattern-fill indirection (see SvgDocument.setImage) — not just <image> itself. */
const IMAGE_CAPABLE_TAGS = new Set(["image", "rect", "g"]);

export interface ValidateTemplateOptions {
  /** Cross-checks the SVG against an already-authored config.json, flagging fields it declares that this file has no element for. */
  config?: TemplateConfig;
}

/**
 * CP4 — everything the sprint asks to validate on import, read-only (never
 * fixes anything, only reports). Takes the parsed `Document` directly so it
 * shares one DOMParser pass with SvgTemplateAnalyzer instead of re-parsing.
 */
export function validateTemplate(document: Document, options: ValidateTemplateOptions = {}): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const idElements = Array.from(document.querySelectorAll("[id]"));

  // Duplicate raw ids — a real authoring mistake (breaks id-based lookups the renderer relies on).
  const idCounts = new Map<string, number>();
  for (const element of idElements) {
    const id = element.getAttribute("id");
    if (!id) continue;
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      errors.push({
        severity: "error",
        category: "duplicate-id",
        message: `O id "${id}" aparece ${count} vezes no SVG — cada id deve ser único.`,
        elementId: id,
      });
    }
  }

  for (const element of idElements) {
    const id = element.getAttribute("id");
    if (!id) continue;
    const prefixType = classifyByIdPrefix(id);
    const tag = element.tagName.toLowerCase();

    // Prefix/tag mismatches — an id claims a convention the element can't fulfil.
    if (prefixType === "text" && !TEXT_CAPABLE_TAGS.has(tag)) {
      errors.push({
        severity: "error",
        category: "invalid-element",
        message: `"${id}" segue a convenção de texto (txt_) mas está em um elemento <${tag}>, que não suporta texto.`,
        elementId: id,
      });
    }
    if (prefixType === "image" && !IMAGE_CAPABLE_TAGS.has(tag)) {
      errors.push({
        severity: "error",
        category: "invalid-element",
        message: `"${id}" segue a convenção de imagem (img_) mas está em um elemento <${tag}>, que não suporta imagem.`,
        elementId: id,
      });
    }

    // Missing image sources — an img_* <image> with no href/xlink:href at all.
    if (prefixType === "image" && tag === "image") {
      const href = element.getAttribute("href") ?? element.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href) {
        warnings.push({
          severity: "warning",
          category: "missing-image",
          message: `A imagem "${id}" não tem nenhuma origem (href) definida no arquivo.`,
          elementId: id,
        });
      }
    }
  }

  // Text elements with no id at all — can't be targeted by the render convention.
  for (const element of Array.from(document.querySelectorAll("text"))) {
    if (element.getAttribute("id")) continue;
    const preview = (element.textContent ?? "").trim().slice(0, 40) || "(vazio)";
    warnings.push({
      severity: "warning",
      category: "unidentified-text",
      message: `Elemento de texto "${preview}" não tem id — não poderá ser editado automaticamente.`,
    });
  }

  // Config cross-check — a declared field with zero matching elements in this SVG,
  // or an `align` hint (CP3/CP4) declared on a field that isn't text at all.
  if (options.config?.fields) {
    const typesByBaseId = new Map<string, Set<string>>();
    for (const element of idElements) {
      const id = element.getAttribute("id");
      if (!id) continue;
      const baseId = parseSlot(id).baseId;
      const types = typesByBaseId.get(baseId) ?? new Set<string>();
      types.add(classifyByIdPrefix(id));
      typesByBaseId.set(baseId, types);
    }

    for (const [baseId, fieldConfig] of Object.entries(options.config.fields)) {
      const types = typesByBaseId.get(baseId);
      if (!types) {
        errors.push({
          severity: "error",
          category: "missing-placeholder",
          message: `O config.json declara o campo "${baseId}", mas nenhum elemento com esse id existe neste SVG.`,
          elementId: baseId,
        });
        continue;
      }
      if (fieldConfig.align && !types.has("text")) {
        errors.push({
          severity: "error",
          category: "invalid-element",
          message: `O config.json declara "align" para o campo "${baseId}", mas esse id não resolve para um elemento de texto neste SVG.`,
          elementId: baseId,
        });
      }
    }
  }

  return { errors, warnings };
}
