import { svgAsPngUri } from "save-svg-as-png";

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

  const svg = div.querySelector("svg");

  if (!svg) {
    document.body.removeChild(div);
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

  document.body.removeChild(div);

  const a = document.createElement("a");
  a.href = png;
  a.download = filename;
  a.click();
}