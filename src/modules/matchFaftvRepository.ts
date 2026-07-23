import { getStore, promisify } from "./db";
import type { FaftvStatus } from "./matchOperationsChecklists";

/** One record per match — `id` is the match's gameRef, so a match has at most one FAFTV record. */
export interface MatchFaftvRecord {
  id: string;
  gameRef: string;
  coordinatorStaffId: string | null;
  commentatorStaffId: string | null;
  broadcastLink: string;
  checklist: Record<string, boolean>;
  status: FaftvStatus;
  updatedAt: number;
}

export class MatchFaftvRepository {
  async get(gameRef: string): Promise<MatchFaftvRecord | undefined> {
    const store = await getStore("matchFaftv", "readonly");
    return promisify(store.get(gameRef));
  }

  async upsert(record: MatchFaftvRecord): Promise<void> {
    const store = await getStore("matchFaftv", "readwrite");
    store.put(record);
  }
}
