import type { IMT } from "../types/imt";
import { formatIMTNumber } from "../types/imt";
import { triggerBlobDownload } from "../utils/downloadBlob";
import { getStore as getStoreForTable, promisify } from "./documentsDb";

const STORE_NAME = "imts";

function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return getStoreForTable(STORE_NAME, mode);
}

/** Persists and queries IMT documents. This is the only place that knows about the storage mechanism. */
export class IMTRepository {
  async list(): Promise<IMT[]> {
    const store = await getStore("readonly");
    return promisify(store.getAll());
  }

  async get(id: string): Promise<IMT | undefined> {
    const store = await getStore("readonly");
    return promisify(store.get(id));
  }

  async remove(id: string): Promise<void> {
    const store = await getStore("readwrite");
    store.delete(id);
  }

  async listBySeason(season: string): Promise<IMT[]> {
    const all = await this.list();
    return all.filter((imt) => imt.season === season);
  }

  /** All IMTs registered for a competition, newest first — backs the "Documentos" tab. */
  async listByCompetition(competitionId: string): Promise<IMT[]> {
    const all = await this.list();
    return all
      .filter((imt) => imt.competitionId === competitionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** All IMTs ever issued for a given match, newest first — the "consulta futura" the sprint asks for. */
  async listByGameRef(gameRef: string): Promise<IMT[]> {
    const all = await this.list();
    return all
      .filter((imt) => imt.gameRef === gameRef)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Next sequential number for the season: highest existing + 1, starting at 1. */
  async nextNumber(season: string): Promise<number> {
    const forSeason = await this.listBySeason(season);
    return forSeason.reduce((max, imt) => Math.max(max, imt.number), 0) + 1;
  }

  async save(imt: IMT): Promise<void> {
    const store = await getStore("readwrite");
    store.put(imt);
  }

  /**
   * Re-derives the PDF from the IMT's stored HTML (never from live match
   * data — the whole point of storing `html` is that an old IMT never
   * changes) and triggers a browser download. Throws if the id isn't found.
   *
   * The PDF exporter (jsPDF/html2canvas + document.css) is imported
   * dynamically so that merely listing/reading IMTs never pulls in the
   * rendering stack — only calling download() does.
   */
  async download(id: string): Promise<void> {
    const imt = await this.get(id);
    if (!imt) throw new Error(`IMT "${id}" não encontrada.`);
    const { exportHtmlToPdf } = await import("../pdf/exportDocument");
    const blob = await exportHtmlToPdf(imt.html);
    triggerBlobDownload(blob, `${formatIMTNumber(imt.number, imt.season).replace(/\s+/g, "-")}.pdf`);
  }
}

export const imtRepository = new IMTRepository();
