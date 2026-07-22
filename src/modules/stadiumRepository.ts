import { getStore, promisify } from "./db";

export interface Stadium {
  id: string;
  name: string;
  cityId: string;
  capacity?: number | null;
  turfType?: string;
  /** Filename under public/assets/, or a data: URI from an upload. */
  image?: string;
  /** Soft-delete marker (ms epoch) — set by "Excluir" (moves to trash), cleared by "Restaurar". */
  deletedAt?: number | null;
}

/** Persists stadium records in IndexedDB, seeded once from tables/stadiums.ts. */
export class StadiumRepository {
  async list(): Promise<Stadium[]> {
    const store = await getStore("stadiums", "readonly");
    return promisify(store.getAll());
  }

  async seedIfEmpty(seed: readonly Stadium[]): Promise<Stadium[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const store = await getStore("stadiums", "readwrite");
    for (const record of seed) store.put(record);
    return [...seed];
  }

  async upsert(record: Stadium): Promise<void> {
    const store = await getStore("stadiums", "readwrite");
    store.put(record);
  }

  async remove(id: string): Promise<void> {
    const store = await getStore("stadiums", "readwrite");
    store.delete(id);
  }
}
