import { supabase } from "@/lib/supabaseClient";

export interface City {
  id: string;
  name: string;
  /** Brazilian state code (e.g. "AL"). */
  state?: string;
  /** Soft-delete marker (ms epoch) — set by "Excluir" (moves to trash), cleared by "Restaurar". */
  deletedAt?: number | null;
}

interface CityRow {
  id: string;
  name: string;
  state: string | null;
  deleted_at: string | null;
}

function fromRow(row: CityRow): City {
  return {
    id: row.id,
    name: row.name,
    state: row.state ?? undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
  };
}

function toRow(city: City): CityRow {
  return {
    id: city.id,
    name: city.name,
    state: city.state ?? null,
    deleted_at: city.deletedAt ? new Date(city.deletedAt).toISOString() : null,
  };
}

/** Persists city records in Supabase (Postgres table "cities", RLS: any authenticated user). */
export class CityRepository {
  async list(): Promise<City[]> {
    const { data, error } = await supabase.from("cities").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async upsert(record: City): Promise<void> {
    const { error } = await supabase.from("cities").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("cities").delete().eq("id", id);
    if (error) throw error;
  }
}

export const cityRepository = new CityRepository();
