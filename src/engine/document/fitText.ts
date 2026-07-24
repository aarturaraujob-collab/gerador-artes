import { measureWidth, readFontFamily, readFontSize, readFontStyle, readFontWeight } from "@/engine/document/textMeasure";

const DEFAULT_MIN_FONT_SIZE = 10;

export interface FitTextOptions {
  /** Smallest font-size fitText is allowed to shrink down to. */
  minFontSize?: number;
}

function applyFontSize(element: Element, size: number): void {
  element.setAttribute("font-size", String(size));
  const style = element.getAttribute("style");
  if (style && /font-size:/.test(style)) {
    element.setAttribute("style", style.replace(/font-size:\s*[\d.]+px?/, `font-size:${size}px`));
  }
}

/**
 * Shrinks a text element's font-size until its rendered width fits within
 * `maxWidth`. Never truncates the text, never moves it, never touches
 * alignment — only `font-size` changes, and only down to `minFontSize`.
 * A no-op when the text already fits.
 */
export function fitText(element: Element, maxWidth: number, options: FitTextOptions = {}): void {
  const minFontSize = options.minFontSize ?? DEFAULT_MIN_FONT_SIZE;
  const text = element.textContent ?? "";
  if (!text.trim() || maxWidth <= 0) return;

  const fontFamily = readFontFamily(element);
  const fontWeight = readFontWeight(element);
  const fontStyle = readFontStyle(element);
  let fontSize = readFontSize(element);

  let width = measureWidth(text, fontSize, fontFamily, fontWeight, fontStyle);
  if (width <= maxWidth) return;

  // Jump straight to the proportional estimate, then fine-tune by whole pixels.
  fontSize = Math.max(minFontSize, Math.floor(fontSize * (maxWidth / width)));
  width = measureWidth(text, fontSize, fontFamily, fontWeight, fontStyle);

  while (width > maxWidth && fontSize > minFontSize) {
    fontSize -= 1;
    width = measureWidth(text, fontSize, fontFamily, fontWeight, fontStyle);
  }

  applyFontSize(element, fontSize);
}
