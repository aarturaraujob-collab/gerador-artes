/** Shared font-attribute reading and canvas-based text measurement, used by fitText and TextAlignmentEngine. */

function attr(element: Element, name: string): string | null {
  return element.getAttribute(name);
}

function styleProp(element: Element, prop: string): string | null {
  const style = element.getAttribute("style");
  if (!style) return null;
  const match = new RegExp(`${prop}:\\s*([^;]+)`).exec(style);
  return match ? match[1].trim() : null;
}

export function readFontSize(element: Element): number {
  const value = attr(element, "font-size") ?? styleProp(element, "font-size");
  const parsed = value ? Number.parseFloat(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 16;
}

export function readFontFamily(element: Element): string {
  return attr(element, "font-family") ?? styleProp(element, "font-family") ?? "sans-serif";
}

export function readFontWeight(element: Element): string {
  return attr(element, "font-weight") ?? styleProp(element, "font-weight") ?? "400";
}

export function readFontStyle(element: Element): string {
  return attr(element, "font-style") ?? styleProp(element, "font-style") ?? "normal";
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

export function measureWidth(text: string, fontSize: number, fontFamily: string, fontWeight: string, fontStyle: string): number {
  const context = getMeasureContext();
  context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  return context.measureText(text).width;
}
