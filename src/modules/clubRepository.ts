import { getStore, promisify } from "./db";

export interface Club {
  id: string;
  shortName: string;
  fullName: string;
  /** Filename under public/assets/escudos/, or a data: URI from an upload. */
  shield: string;
  cityId?: string;
  /** Brazilian state code (e.g. "AL"). */
  state?: string;
  primaryColor?: string;
  secondaryColor?: string;
  foundedYear?: number | null;
  /** Soft-delete marker (ms epoch) — set by "Excluir" (moves to trash), cleared by "Restaurar". */
  deletedAt?: number | null;
}

/** Persists club records in IndexedDB, seeded once from tables/clubs.ts. */
export class ClubRepository {
  async list(): Promise<Club[]> {
    const store = await getStore("clubs", "readonly");
    return promisify(store.getAll());
  }

  async seedIfEmpty(seed: readonly Club[]): Promise<Club[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const store = await getStore("clubs", "readwrite");
    for (const record of seed) store.put(record);
    return [...seed];
  }

  async upsert(record: Club): Promise<void> {
    const store = await getStore("clubs", "readwrite");
    store.put(record);
  }

  async remove(id: string): Promise<void> {
    const store = await getStore("clubs", "readwrite");
    store.delete(id);
  }
}
