import html2canvas from "html2canvas";

/** Snapshots a visible DOM element to a PNG and triggers a download — used to share player cards. */
export async function exportElementAsImage(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}
