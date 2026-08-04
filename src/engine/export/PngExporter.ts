import { svgAsPngUri } from "save-svg-as-png";
import { triggerBlobDownload } from "@/documents/utils/downloadBlob";

export async function exportToPng(
  svgString: string,
  width = 1080,
  height = 1350,
  filename = "arte.png"
) {
  const div = document.createElement("div");

  div.style.position = "fixed";
  div.style.left = "-99999px";

  div.innerHTML = svgString;

  document.body.appendChild(div);

  try {
    const svg = div.querySelector("svg");

    if (!svg) {
      throw new Error("SVG não encontrado");
    }

    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    await document.fonts.ready;

    const png = await svgAsPngUri(svg, {
      scale: 1,
      encoderOptions: 1,
      backgroundColor: "transparent",
    });

    const blob = await (await fetch(png)).blob();
    await triggerBlobDownload(blob, filename);
  } finally {
    document.body.removeChild(div);
  }
}