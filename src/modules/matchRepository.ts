import { getDb, getStore, promisify } from "./db";
import { buildGameRef } from "./gameRef";
import type { Match } from "./dataStore";

/** A Match as stored in IndexedDB — same shape, plus the gameRef-derived `id` the store keys on. */
export type StoredMatch = Match & { id: string };

function toStored(match: Match): StoredMatch {
  return { ...match, id: buildGameRef(match) };
}

/** Persists match records in IndexedDB, seeded once from tables/matches.ts. */
export class MatchRepository {
  async list(): Promise<StoredMatch[]> {
    const store = await getStore("matches", "readonly");
    return promisify(store.getAll());
  }

  async seedIfEmpty(seed: readonly Match[]): Promise<StoredMatch[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const store = await getStore("matches", "readwrite");
    const stored = seed.map(toStored);
    for (const record of stored) store.put(record);
    return stored;
  }

  /**
   * Atomically replaces every match belonging to `competitionId` with
   * `records` — matches an import wholesale-replacing a competition's
   * schedule, not merging row by row. Same single-transaction pattern as
   * detailedTableRepository.saveNewVersion, so a reader never sees a
   * half-replaced competition.
   */
  async replaceForCompetition(competitionId: string, records: readonly Match[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("matches", "readwrite");
    const store = tx.objectStore("matches");

    const existing = await promisify<StoredMatch[]>(store.getAll());
    for (const item of existing) {
      if (item.competitionId === competitionId) store.delete(item.id);
    }
    for (const record of records) store.put(toStored(record));

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Transação abortada ao salvar as partidas."));
    });
  }
}

export const matchRepository = new MatchRepository();
