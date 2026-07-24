import type { TemplateConfig } from "@/engine/core/TemplateConfig";
import type { SvgDocument } from "@/engine/document/SvgDocument";
import { fitText } from "@/engine/document/fitText";
import { applyAlignment } from "@/engine/layout/TextAlignmentEngine";

/** Slot id for the Nth (0-based) repeated instance of a base id — `slotId("txt_pos", 0)` is `txt_pos`, `slotId("txt_pos", 1)` is `txt_pos_2`. */
export function slotId(base: string, index: number): string {
  return index === 0 ? base : `${base}_${index + 1}`;
}

/**
 * Sets a text slot and, when the template declares field hints, applies them
 * in order: fitText may shrink the font to fit `maxWidth`, then applyAlignment
 * repositions the text to preserve the anchor the designer drew (derived from
 * the field's own original placeholder, not a cached value) — using the
 * post-fitText font-size. Templates that declare nothing keep the exact
 * raw-replace behavior; both steps are opt-in. Shared by every renderer that
 * fills a template's text slots.
 */
export function applyTextField(document: SvgDocument, config: TemplateConfig, baseId: string, index: number, value: string): void {
  const id = slotId(baseId, index);
  document.setText(id, value);

  const field = config.fields?.[baseId];
  if (!field) return;

  const node = document.getNode(id);
  if (!node) return;

  if (field.maxWidth) fitText(node.element, field.maxWidth, { minFontSize: field.minFontSize });
  if (field.align) applyAlignment(node, field.align, value);
}
