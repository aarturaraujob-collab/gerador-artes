import type { IMT } from "../types/imt";
import { formatIMTNumber } from "../types/imt";
import { triggerBlobDownload } from "../utils/downloadBlob";

/**
 * Dedicated IndexedDB database for the documents module — deliberately
 * separate from src/modules/db.ts (the app's shared database) so this
 * module stays fully self-contained, per the sprint's "independent module"
 * requirement. No existing file needs to change to add this store.
 */
const DB_NAME = "urano-faf-documents";
const DB_VERSION = 1;
const STORE_NAME = "imts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("season", "season", { unique: false });
        store.createIndex("gameRef", "gameRef", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

async function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await getDb();
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
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
    const { exportIMTToPdf } = await import("../pdf/exportIMT");
    const blob = await exportIMTToPdf(imt.html);
    triggerBlobDownload(blob, `${formatIMTNumber(imt.number, imt.season).replace(/\s+/g, "-")}.pdf`);
  }
}

export const imtRepository = new IMTRepository();
