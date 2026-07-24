import type { DetailedTable } from "../types/detailedTable";
import { formatDetailedTableVersion } from "../types/detailedTable";
import { triggerBlobDownload } from "../utils/downloadBlob";
import { getDb, getStore as getStoreForTable, promisify } from "./documentsDb";

const STORE_NAME = "detailedTables";

function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return getStoreForTable(STORE_NAME, mode);
}

/** Persists and queries Tabela Detalhada documents — the only place that knows about the storage mechanism. */
export class DetailedTableRepository {
  async list(): Promise<DetailedTable[]> {
    const store = await getStore("readonly");
    return promisify(store.getAll());
  }

  async get(id: string): Promise<DetailedTable | undefined> {
    const store = await getStore("readonly");
    return promisify(store.get(id));
  }

  async remove(id: string): Promise<void> {
    const store = await getStore("readwrite");
    store.delete(id);
  }

  /** Every version registered for the competition, newest first — backs the "Documentos" tab. */
  async listByCompetition(competitionId: string): Promise<DetailedTable[]> {
    const all = await this.list();
    return all
      .filter((table) => table.competitionId === competitionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** The single CURRENT version for a competition, if one has ever been generated. */
  async getCurrent(competitionId: string): Promise<DetailedTable | undefined> {
    const all = await this.listByCompetition(competitionId);
    return all.find((table) => table.status === "CURRENT");
  }

  /** Next sequential version for the competition: highest existing + 1, starting at 1. */
  async nextVersion(competitionId: string): Promise<number> {
    const all = await this.listByCompetition(competitionId);
    return all.reduce((max, table) => Math.max(max, table.version), 0) + 1;
  }

  /**
   * Persists a new CURRENT version, atomically archiving whatever was
   * CURRENT before it — in the same transaction, so a reader never sees two
   * CURRENT versions (or none) for the same competition.
   */
  async saveNewVersion(table: DetailedTable): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const existing = await promisify<DetailedTable[]>(store.getAll());
    for (const item of existing) {
      if (item.competitionId === table.competitionId && item.status === "CURRENT") {
        store.put({ ...item, status: "ARCHIVED" });
      }
    }
    store.put(table);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Transação abortada ao salvar a Tabela Detalhada."));
    });
  }

  /**
   * Re-derives the PDF from the version's stored HTML (never from live
   * standings/matches — the whole point of storing `html` is that an old
   * version never changes) and triggers a browser download.
   */
  async download(id: string): Promise<void> {
    const table = await this.get(id);
    if (!table) throw new Error(`Tabela Detalhada "${id}" não encontrada.`);
    const { exportHtmlToPdf } = await import("../pdf/exportDocument");
    const blob = await exportHtmlToPdf(table.html);
    triggerBlobDownload(blob, `${formatDetailedTableVersion(table.version, table.season).replace(/\s+/g, "-")}.pdf`);
  }
}

export const detailedTableRepository = new DetailedTableRepository();
