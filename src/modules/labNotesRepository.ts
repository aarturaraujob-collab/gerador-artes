import { supabase } from "@/lib/supabaseClient";

export interface LabNotes {
  id: string;
  notes: string;
  updatedAt: number;
}

interface LabNotesRow {
  id: string;
  notes: string;
  updated_at: string;
}

function fromRow(row: LabNotesRow): LabNotes {
  return { id: row.id, notes: row.notes, updatedAt: new Date(row.updated_at).getTime() };
}

/** Free-text notes per competition edition, shown on the FAF Lab dashboard. */
export class LabNotesRepository {
  async get(competitionId: string): Promise<LabNotes | null> {
    const { data, error } = await supabase.from("lab_notes").select("*").eq("id", competitionId).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  }

  async set(competitionId: string, notes: string): Promise<void> {
    const row: LabNotesRow = { id: competitionId, notes, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("lab_notes").upsert(row);
    if (error) throw error;
  }
}

export const labNotesRepository = new LabNotesRepository();
