import { supabase } from "@/lib/supabaseClient";
import type { ArbitragemStatus } from "./matchOperationsChecklists";

/** One record per match — `id` is the match's gameRef, so a match has at most one escala de arbitragem. */
export interface MatchArbitragemRecord {
  id: string;
  gameRef: string;
  arbitroStaffId: string | null;
  primeiroAssistenteStaffId: string | null;
  segundoAssistenteStaffId: string | null;
  quartoArbitroStaffId: string | null;
  delegadoStaffId: string | null;
  observadorStaffId: string | null;
  status: ArbitragemStatus;
  updatedAt: number;
}

interface MatchArbitragemRow {
  id: string;
  game_ref: string;
  arbitro_staff_id: string | null;
  primeiro_assistente_staff_id: string | null;
  segundo_assistente_staff_id: string | null;
  quarto_arbitro_staff_id: string | null;
  delegado_staff_id: string | null;
  observador_staff_id: string | null;
  status: string;
  updated_at: string;
}

function fromRow(row: MatchArbitragemRow): MatchArbitragemRecord {
  return {
    id: row.id,
    gameRef: row.game_ref,
    arbitroStaffId: row.arbitro_staff_id,
    primeiroAssistenteStaffId: row.primeiro_assistente_staff_id,
    segundoAssistenteStaffId: row.segundo_assistente_staff_id,
    quartoArbitroStaffId: row.quarto_arbitro_staff_id,
    delegadoStaffId: row.delegado_staff_id,
    observadorStaffId: row.observador_staff_id,
    status: row.status as ArbitragemStatus,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function toRow(record: MatchArbitragemRecord): MatchArbitragemRow {
  return {
    id: record.id,
    game_ref: record.gameRef,
    arbitro_staff_id: record.arbitroStaffId,
    primeiro_assistente_staff_id: record.primeiroAssistenteStaffId,
    segundo_assistente_staff_id: record.segundoAssistenteStaffId,
    quarto_arbitro_staff_id: record.quartoArbitroStaffId,
    delegado_staff_id: record.delegadoStaffId,
    observador_staff_id: record.observadorStaffId,
    status: record.status,
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

/** Persists a competition's per-match escala de arbitragem (árbitro, assistentes, 4º árbitro, delegado, observador). */
export class MatchArbitragemRepository {
  async get(gameRef: string): Promise<MatchArbitragemRecord | undefined> {
    const { data, error } = await supabase.from("match_arbitragem").select("*").eq("id", gameRef).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  }

  async listByGameRefs(gameRefs: readonly string[]): Promise<MatchArbitragemRecord[]> {
    if (gameRefs.length === 0) return [];
    const { data, error } = await supabase.from("match_arbitragem").select("*").in("id", gameRefs);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async upsert(record: MatchArbitragemRecord): Promise<void> {
    const { error } = await supabase.from("match_arbitragem").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(gameRef: string): Promise<void> {
    const { error } = await supabase.from("match_arbitragem").delete().eq("id", gameRef);
    if (error) throw error;
  }
}

export const matchArbitragemRepository = new MatchArbitragemRepository();
