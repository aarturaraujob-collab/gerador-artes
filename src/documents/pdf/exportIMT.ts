import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

import documentCss from "../styles/document.css?raw";

/**
 * Converts a ready-made HTML fragment (as produced by renderIMT) into a PDF
 * Blob. Deliberately knows nothing about the database, competitions or
 * matches — it only ever sees the HTML string it's handed.
 *
 * Renders the fragment off-screen (with the same document.css the preview
 * uses) and rasterizes it via html2canvas before embedding it in an A4
 * jsPDF page — this is what guarantees the PDF matches the preview
 * pixel-for-pixel: it's a snapshot of the exact same rendered DOM+CSS.
 */
export async function exportIMTToPdf(html: string): Promise<Blob> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-99999px";
  container.style.zIndex = "-1";

  const style = document.createElement("style");
  style.textContent = documentCss;
  container.appendChild(style);

  const content = document.createElement("div");
  content.innerHTML = html;
  container.appendChild(content);

  document.body.appendChild(container);

  try {
    const target = content.firstElementChild as HTMLElement | null;
    if (!target) throw new Error("HTML da IMT está vazio — nada para exportar.");

    const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff" });

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imageHeight = (canvas.height * pageWidth) / canvas.width;

    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageWidth, imageHeight);

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}
