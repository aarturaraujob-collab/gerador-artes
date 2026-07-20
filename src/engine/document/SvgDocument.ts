// SvgDocument.ts
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
  private cloneCounter = 0;

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

      this.nodes.set(id, { id, type, element });
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

    const tspans =
      node.element.querySelectorAll("tspan");

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

  private ensureUniquePatternImage(
    pattern: Element
  ): Element | null {
    const direct =
      pattern.querySelector("image");

    if (direct) return direct;

    const use = pattern.querySelector("use");
    if (!use) return null;

    const ref =
      use.getAttribute("href") ??
      use.getAttributeNS(
        "http://www.w3.org/1999/xlink",
        "href"
      );

    if (!ref) return null;

    const imageId = ref.replace(/^#/, "");

    const image =
      this.xml.getElementById(imageId);

    if (!image) return null;

    const users = Array.from(
      this.xml.querySelectorAll("pattern use")
    ).filter((u) => {
      const href =
        u.getAttribute("href") ??
        u.getAttributeNS(
          "http://www.w3.org/1999/xlink",
          "href"
        );

      return href === `#${imageId}`;
    });

    if (users.length <= 1) {
      return image;
    }

    const clone =
      image.cloneNode(true) as Element;

    const newId =
      `${imageId}__clone_${++this.cloneCounter}`;

    clone.setAttribute("id", newId);

    image.parentNode!.appendChild(clone);

    use.setAttribute("href", `#${newId}`);
    use.setAttributeNS(
      "http://www.w3.org/1999/xlink",
      "href",
      `#${newId}`
    );

    return clone;
  }

  private updatePatternRect(
    rect: Element,
    href: string
  ) {
    const fill = rect.getAttribute("fill");
    if (!fill) return;

    const match =
      fill.match(/url\(#([^)]+)\)/);

    if (!match) return;

    const pattern =
      this.xml.getElementById(match[1]);

    if (!pattern) return;

    const image =
      this.ensureUniquePatternImage(
        pattern
      );

    if (!image) return;

    this.updateImageElement(image, href);
  }

  setImage(id: string, href: string) {
    const node = this.getNode(id);
    if (!node) return;

    const tag =
      node.element.tagName.toLowerCase();

    if (tag === "image") {
      this.updateImageElement(
        node.element,
        href
      );
      return;
    }

    if (tag === "rect") {
      this.updatePatternRect(
        node.element,
        href
      );
      return;
    }

    const rects =
      node.element.querySelectorAll("rect");

    rects.forEach((rect) => {
      this.updatePatternRect(rect, href);
    });
  }

  toString() {
    return new XMLSerializer().serializeToString(
      this.xml
    );
  }
}
