import { supabase } from "@/lib/supabaseClient";

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

interface StadiumRow {
  id: string;
  name: string;
  city_id: string | null;
  capacity: number | null;
  turf_type: string | null;
  image: string | null;
  deleted_at: string | null;
}

function fromRow(row: StadiumRow): Stadium {
  return {
    id: row.id,
    name: row.name,
    cityId: row.city_id ?? "",
    capacity: row.capacity,
    turfType: row.turf_type ?? undefined,
    image: row.image ?? undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
  };
}

function toRow(stadium: Stadium): StadiumRow {
  return {
    id: stadium.id,
    name: stadium.name,
    // Empty string (a handful of legacy rows imported with no city) isn't a
    // valid foreign key — only a real id or null satisfies the FK constraint.
    city_id: stadium.cityId || null,
    capacity: stadium.capacity ?? null,
    turf_type: stadium.turfType ?? null,
    image: stadium.image ?? null,
    deleted_at: stadium.deletedAt ? new Date(stadium.deletedAt).toISOString() : null,
  };
}

/** Persists stadium records in Supabase (Postgres table "stadiums", RLS: any authenticated user). */
export class StadiumRepository {
  async list(): Promise<Stadium[]> {
    const { data, error } = await supabase.from("stadiums").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async upsert(record: Stadium): Promise<void> {
    const { error } = await supabase.from("stadiums").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("stadiums").delete().eq("id", id);
    if (error) throw error;
  }
}
