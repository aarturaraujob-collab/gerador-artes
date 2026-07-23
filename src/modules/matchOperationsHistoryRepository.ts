import { getStore, promisify } from "./db";

export type MatchOperationsModule = "faftv" | "operacao";

export interface MatchHistoryEntry {
  id: string;
  gameRef: string;
  module: MatchOperationsModule;
  operator: string;
  description: string;
  timestamp: number;
}

/**
 * Per-match audit trail (CP6) — separate from the global, 50-entry-capped
 * `activityLog.ts`, since this one must be uncapped and scoped per match.
 * No dedicated gameRef index: entries are read a match at a time, and
 * getAll()+filter() is the same technique `imtRepository.listByGameRef`
 * already uses at this data scale.
 */
export class MatchOperationsHistoryRepository {
  async listByGameRef(gameRef: string): Promise<MatchHistoryEntry[]> {
    const store = await getStore("matchOperationsHistory", "readonly");
    const all = await promisify(store.getAll());
    return all
      .filter((entry) => entry.gameRef === gameRef)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async append(entry: MatchHistoryEntry): Promise<void> {
    const store = await getStore("matchOperationsHistory", "readwrite");
    store.put(entry);
  }
}
