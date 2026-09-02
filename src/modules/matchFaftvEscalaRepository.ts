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
  /** Shown whenever o item de checklist "falha-live" está marcado — o que deu errado na transmissão. */
  motivoFalhaLive: string;
  broadcastLink: string;
  observacoes: string;
  checklist: Record<string, boolean>;
  status: FaftvEscalaStatus;
  /** Override do cachê desta partida — null usa o padrão em faftv_settings. */
  valorCinegrafista: number | null;
  /** Override da diária do coordenador nesta partida — null usa o padrão em faftv_settings. */
  valorCoordenadorDiaria: number | null;
  /** Valor pontual somado por cima do cachê desta partida, quando necessário. */
  valorExtra: number;
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
  motivo_falha_live: string | null;
  broadcast_link: string | null;
  observacoes: string | null;
  checklist: Record<string, boolean>;
  status: string;
  valor_cinegrafista: number | null;
  valor_coordenador_diaria: number | null;
  valor_extra: number | null;
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
    motivoFalhaLive: row.motivo_falha_live ?? "",
    broadcastLink: row.broadcast_link ?? "",
    observacoes: row.observacoes ?? "",
    checklist: row.checklist ?? {},
    status: row.status as FaftvEscalaStatus,
    valorCinegrafista: row.valor_cinegrafista,
    valorCoordenadorDiaria: row.valor_coordenador_diaria,
    valorExtra: row.valor_extra ?? 0,
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
    motivo_falha_live: record.motivoFalhaLive || null,
    broadcast_link: record.broadcastLink || null,
    observacoes: record.observacoes || null,
    checklist: record.checklist,
    status: record.status,
    valor_cinegrafista: record.valorCinegrafista,
    valor_coordenador_diaria: record.valorCoordenadorDiaria,
    valor_extra: record.valorExtra,
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
    const row = toRow(record);
    const { error } = await supabase.from("match_faftv_escala").upsert(row);
    if (!error) return;

    // valor_cinegrafista/valor_coordenador_diaria/valor_extra/motivo_falha_live
    // are newer columns (migration at the bottom of schema.sql) — until it's
    // actually applied to this Supabase project, PostgREST rejects the
    // *entire* write for referencing columns it doesn't know about (same
    // failure mode as competitions.format). Retry without them so the rest
    // of the escala still saves, instead of breaking every FAFTV edit.
    if (error.message.includes("column")) {
      const { valor_cinegrafista: _c, valor_coordenador_diaria: _d, valor_extra: _e, motivo_falha_live: _f, ...rowWithoutNewColumns } = row;
      const { error: retryError } = await supabase.from("match_faftv_escala").upsert(rowWithoutNewColumns);
      if (retryError) throw retryError;
      throw new Error(
        "Operação salva, mas cachê/valor extra/motivo da falha não foram — falta rodar a migração pendente em match_faftv_escala no Supabase.",
      );
    }
    throw error;
  }

  async remove(gameRef: string): Promise<void> {
    const { error } = await supabase.from("match_faftv_escala").delete().eq("id", gameRef);
    if (error) throw error;
  }
}

export const matchFaftvEscalaRepository = new MatchFaftvEscalaRepository();
