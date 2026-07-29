import { supabase } from "@/lib/supabaseClient";

export type FaftvEscalaStatus = "a_acontecer" | "confirmado" | "cancelado";

/** One record per match — `id` is the match's gameRef, so a match has at most one escala FAFTV (Coordenador/Produtor/Cinegrafista). */
export interface MatchFaftvEscalaRecord {
  id: string;
  gameRef: string;
  /** More than one coordenador can be escalado for the same match when needed. */
  coordenadorStaffIds: string[];
  produtorStaffId: string | null;
  cinegrafistaStaffId: string | null;
  transmitir: boolean;
  /** Required whenever `transmitir` is false — the reason the match wasn't broadcast. */
  motivoNaoTransmitido: string;
  broadcastLink: string;
  observacoes: string;
  checklist: Record<string, boolean>;
  status: FaftvEscalaStatus;
  updatedAt: number;
}

interface MatchFaftvEscalaRow {
  id: string;
  game_ref: string;
  coordenador_staff_ids: string[] | null;
  produtor_staff_id: string | null;
  cinegrafista_staff_id: string | null;
  transmitir: boolean;
  motivo_nao_transmitido: string | null;
  broadcast_link: string | null;
  observacoes: string | null;
  checklist: Record<string, boolean>;
  status: string;
  updated_at: string;
}

function fromRow(row: MatchFaftvEscalaRow): MatchFaftvEscalaRecord {
  return {
    id: row.id,
    gameRef: row.game_ref,
    coordenadorStaffIds: row.coordenador_staff_ids ?? [],
    produtorStaffId: row.produtor_staff_id,
    cinegrafistaStaffId: row.cinegrafista_staff_id,
    transmitir: row.transmitir,
    motivoNaoTransmitido: row.motivo_nao_transmitido ?? "",
    broadcastLink: row.broadcast_link ?? "",
    observacoes: row.observacoes ?? "",
    checklist: row.checklist ?? {},
    status: row.status as FaftvEscalaStatus,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function toRow(record: MatchFaftvEscalaRecord): MatchFaftvEscalaRow {
  return {
    id: record.id,
    game_ref: record.gameRef,
    coordenador_staff_ids: record.coordenadorStaffIds,
    produtor_staff_id: record.produtorStaffId,
    cinegrafista_staff_id: record.cinegrafistaStaffId,
    transmitir: record.transmitir,
    motivo_nao_transmitido: record.motivoNaoTransmitido || null,
    broadcast_link: record.broadcastLink || null,
    observacoes: record.observacoes || null,
    checklist: record.checklist,
    status: record.status,
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

/** Persists a competition-wide escala FAFTV (Coordenador/Produtor/Cinegrafista) per match, independent of the existing match_faftv broadcast-checklist table. */
export class MatchFaftvEscalaRepository {
  async listAll(): Promise<MatchFaftvEscalaRecord[]> {
    const { data, error } = await supabase.from("match_faftv_escala").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async listByGameRefs(gameRefs: readonly string[]): Promise<MatchFaftvEscalaRecord[]> {
    if (gameRefs.length === 0) return [];
    const { data, error } = await supabase.from("match_faftv_escala").select("*").in("id", gameRefs);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async upsert(record: MatchFaftvEscalaRecord): Promise<void> {
    const { error } = await supabase.from("match_faftv_escala").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(gameRef: string): Promise<void> {
    const { error } = await supabase.from("match_faftv_escala").delete().eq("id", gameRef);
    if (error) throw error;
  }
}

export const matchFaftvEscalaRepository = new MatchFaftvEscalaRepository();
