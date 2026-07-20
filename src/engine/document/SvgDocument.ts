export type SvgNodeType =
  | "text"
  | "image"
  | "group"
  | "shape";

export interface SvgNode {
  id: string;
  type: SvgNodeType;
  element: Element;
}

export class SvgDocument {
  private xml: Document;

  private nodes = new Map<string, SvgNode>();

  constructor(svg: string) {
    this.xml = new DOMParser().parseFromString(
      svg,
      "image/svg+xml"
    );

    this.index();
  }

  private index() {
    const elements = Array.from(
      this.xml.querySelectorAll("[id]")
    );

    elements.forEach((element) => {
      const id = element.getAttribute("id");

      if (!id) return;

      let type: SvgNodeType = "shape";

      if (id.startsWith("txt_")) type = "text";
      else if (id.startsWith("img_")) type = "image";
      else if (id.startsWith("grp_")) type = "group";

      this.nodes.set(id, {
        id,
        type,
        element,
      });
    });
  }

  getNode(id: string) {
    return this.nodes.get(id);
  }

  getNodes() {
    return [...this.nodes.values()];
  }

  getTextNodes() {
    return this.getNodes().filter(
      (n) => n.type === "text"
    );
  }

  setText(id: string, value: string) {
    const node = this.getNode(id);
    if (!node) return;

    const tspans = node.element.querySelectorAll("tspan");

    if (tspans.length > 0) {
      tspans.forEach((ts, i) => {
        ts.textContent = i === 0 ? value : "";
      });
    } else {
      node.element.textContent = value;
    }
  }

  hide(id: string) {
    const node = this.getNode(id);

    if (!node) return;

    node.element.setAttribute("display", "none");
  }

  show(id: string) {
    const node = this.getNode(id);

    if (!node) return;

    node.element.removeAttribute("display");
  }

  private updateImageElement(
    element: Element,
    href: string
  ) {
    element.setAttribute("href", href);
    element.setAttributeNS(
      "http://www.w3.org/1999/xlink",
      "href",
      href
    );
  }

  private updatePatternRect(
    rect: Element,
    href: string
  ) {
    const fill = rect.getAttribute("fill");
    if (!fill) return;

    const match = fill.match(/url\(#([^)]+)\)/);
    if (!match) return;

    const patternId = match[1];
    const pattern = this.xml.getElementById(patternId);
    if (!pattern) return;

    const use = pattern.querySelector("use");
    if (!use) return;

    const imageRef =
      use.getAttribute("href") ??
      use.getAttributeNS(
        "http://www.w3.org/1999/xlink",
        "href"
      );

    if (!imageRef) return;

    const imageId = imageRef.replace(/^#/, "");
    const image = this.xml.getElementById(imageId);
    if (!image) return;

    this.updateImageElement(image, href);
  }

  setImage(id: string, href: string) {
    const node = this.getNode(id);
    if (!node) return;

    // Caso seja um <image> direto
    if (node.element.tagName.toLowerCase() === "image") {
      this.updateImageElement(node.element, href);
      return;
    }

    // Procura TODOS os <rect> que usam pattern fill
    // (SVGs do Figma podem ter múltiplos rects: um na
    //  mask e outro visível, ambos precisam ser atualizados)
    const rects = node.element.querySelectorAll("rect");
    rects.forEach((rect) => {
      const fill = rect.getAttribute("fill");
      if (fill && fill.startsWith("url(#")) {
        this.updatePatternRect(rect, href);
      }
    });
  }

  toString() {
    return new XMLSerializer().serializeToString(
      this.xml
    );
  }
}