import html2canvas from "html2canvas";
import { triggerBlobDownload } from "@/documents/utils/downloadBlob";

/** Snapshots a visible DOM element to a PNG and triggers a download — used to share player cards. */
export async function exportElementAsImage(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Falha ao gerar a imagem.");
  await triggerBlobDownload(blob, filename);
}
