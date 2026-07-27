import { supabase } from "@/lib/supabaseClient";

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

interface ClubRow {
  id: string;
  short_name: string;
  full_name: string;
  shield: string | null;
  city_id: string | null;
  state: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  founded_year: number | null;
  deleted_at: string | null;
}

function fromRow(row: ClubRow): Club {
  return {
    id: row.id,
    shortName: row.short_name,
    fullName: row.full_name,
    shield: row.shield ?? "",
    cityId: row.city_id ?? undefined,
    state: row.state ?? undefined,
    primaryColor: row.primary_color ?? undefined,
    secondaryColor: row.secondary_color ?? undefined,
    foundedYear: row.founded_year,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
  };
}

function toRow(club: Club): ClubRow {
  return {
    id: club.id,
    short_name: club.shortName,
    full_name: club.fullName,
    shield: club.shield || null,
    city_id: club.cityId ?? null,
    state: club.state ?? null,
    primary_color: club.primaryColor ?? null,
    secondary_color: club.secondaryColor ?? null,
    founded_year: club.foundedYear ?? null,
    deleted_at: club.deletedAt ? new Date(club.deletedAt).toISOString() : null,
  };
}

/** Persists club records in Supabase (Postgres table "clubs", RLS: any authenticated user). */
export class ClubRepository {
  async list(): Promise<Club[]> {
    const { data, error } = await supabase.from("clubs").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async upsert(record: Club): Promise<void> {
    const { error } = await supabase.from("clubs").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("clubs").delete().eq("id", id);
    if (error) throw error;
  }
}
