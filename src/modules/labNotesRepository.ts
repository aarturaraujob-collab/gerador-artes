import { getStore, promisify } from "./db";

export interface LabNotes {
  id: string;
  notes: string;
  updatedAt: number;
}

/** Free-text notes per competition edition, shown on the FAF Lab dashboard. */
export class LabNotesRepository {
  async get(competitionId: string): Promise<LabNotes | null> {
    const store = await getStore("labNotes", "readonly");
    const record = await promisify<LabNotes | undefined>(store.get(competitionId));
    return record ?? null;
  }

  async set(competitionId: string, notes: string): Promise<void> {
    const store = await getStore("labNotes", "readwrite");
    store.put({ id: competitionId, notes, updatedAt: Date.now() } satisfies LabNotes);
  }
}

export const labNotesRepository = new LabNotesRepository();
