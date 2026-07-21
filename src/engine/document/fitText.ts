const DEFAULT_MIN_FONT_SIZE = 10;

export interface FitTextOptions {
  /** Smallest font-size fitText is allowed to shrink down to. */
  minFontSize?: number;
}

function attr(element: Element, name: string): string | null {
  return element.getAttribute(name);
}

function styleProp(element: Element, prop: string): string | null {
  const style = element.getAttribute("style");
  if (!style) return null;
  const match = new RegExp(`${prop}:\\s*([^;]+)`).exec(style);
  return match ? match[1].trim() : null;
}

function readFontSize(element: Element): number {
  const value = attr(element, "font-size") ?? styleProp(element, "font-size");
  const parsed = value ? Number.parseFloat(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 16;
}

function readFontFamily(element: Element): string {
  return attr(element, "font-family") ?? styleProp(element, "font-family") ?? "sans-serif";
}

function readFontWeight(element: Element): string {
  return attr(element, "font-weight") ?? styleProp(element, "font-weight") ?? "400";
}

function readFontStyle(element: Element): string {
  return attr(element, "font-style") ?? styleProp(element, "font-style") ?? "normal";
}

function applyFontSize(element: Element, size: number): void {
  element.setAttribute("font-size", String(size));
  const style = element.getAttribute("style");
  if (style && /font-size:/.test(style)) {
    element.setAttribute("style", style.replace(/font-size:\s*[\d.]+px?/, `font-size:${size}px`));
  }
}

let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureContext) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D não disponível para medir texto.");
    measureContext = context;
  }
  return measureContext;
}

function measureWidth(text: string, fontSize: number, fontFamily: string, fontWeight: string, fontStyle: string): number {
  const context = getMeasureContext();
  context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  return context.measureText(text).width;
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
