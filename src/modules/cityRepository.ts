import { getStore, promisify } from "./db";

export interface City {
  id: string;
  name: string;
  /** Brazilian state code (e.g. "AL"). */
  state?: string;
  /** Soft-delete marker (ms epoch) — set by "Excluir" (moves to trash), cleared by "Restaurar". */
  deletedAt?: number | null;
}

/** Persists city records in IndexedDB, seeded once from tables/cities.ts. */
export class CityRepository {
  async list(): Promise<City[]> {
    const store = await getStore("cities", "readonly");
    return promisify(store.getAll());
  }

  async seedIfEmpty(seed: readonly City[]): Promise<City[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const store = await getStore("cities", "readwrite");
    for (const record of seed) store.put(record);
    return [...seed];
  }

  async upsert(record: City): Promise<void> {
    const store = await getStore("cities", "readwrite");
    store.put(record);
  }

  async remove(id: string): Promise<void> {
    const store = await getStore("cities", "readwrite");
    store.delete(id);
  }
}

export const cityRepository = new CityRepository();
