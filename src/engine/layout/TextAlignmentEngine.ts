import type { SvgNode } from "@/engine/document/SvgDocument";
import { measureWidth, readFontFamily, readFontSize, readFontStyle, readFontWeight } from "@/engine/document/textMeasure";
import type { TextAlign } from "@/engine/core/TemplateConfig";

function positionedTarget(element: Element): Element {
  return element.querySelector("tspan") ?? element;
}

/**
 * Repositions a text field's `x` so new content keeps the horizontal anchor
 * the designer drew, instead of the raw left-edge replace `SvgDocument.setText`
 * does on its own. The anchor is derived fresh from the node's original
 * (pre-mutation) placeholder text and font-size every time — never a cached
 * number — so it can't drift from a re-exported template.
 *
 * `align: "start"` is a no-op: that's exactly what `setText` already does.
 */
export function applyAlignment(node: SvgNode, align: TextAlign, newText: string): void {
  if (align === "start") return;
  if (node.originalText === undefined || node.originalFontSize === undefined) return;

  const target = positionedTarget(node.element);
  const originalX = Number.parseFloat(target.getAttribute("x") ?? "");
  if (!Number.isFinite(originalX)) return;

  const fontFamily = readFontFamily(node.element);
  const fontWeight = readFontWeight(node.element);
  const fontStyle = readFontStyle(node.element);
  const currentFontSize = readFontSize(node.element);

  const originalWidth = measureWidth(node.originalText, node.originalFontSize, fontFamily, fontWeight, fontStyle);
  const newWidth = measureWidth(newText, currentFontSize, fontFamily, fontWeight, fontStyle);

  const originalAnchor = align === "end" ? originalX + originalWidth : originalX + originalWidth / 2;
  const newX = align === "end" ? originalAnchor - newWidth : originalAnchor - newWidth / 2;

  target.setAttribute("x", String(newX));
}
