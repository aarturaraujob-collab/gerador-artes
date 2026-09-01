import { supabase } from "@/lib/supabaseClient";

export interface FafArbitragemEntry {
  funcao: string;
  nome: string;
  abreviatura: string;
}

export interface FafAlteracaoEntry {
  dataOriginal: string;
  horarioOriginal: string;
  estadioOriginal: string;
  dataFinal: string;
  horarioFinal: string;
  estadioFinal: string;
  motivo: string;
  dataInclusao: string;
}

/** Read-only official data pulled from the FAF site's per-match page — id is the match's gameRef, same pattern as MatchBordero. Never edited in Urano, only overwritten by the next "Atualizar Info (FAF)". */
export interface MatchFafOficial {
  id: string;
  gameRef: string;
  competitionId: string;
  sumulaUrl: string;
  borderoOficialUrl: string;
  adendoUrl: string;
  arbitragem: FafArbitragemEntry[];
  alteracoes: FafAlteracaoEntry[];
  updatedAt: number;
}

interface MatchFafOficialRow {
  id: string;
  game_ref: string;
  competition_id: string;
  sumula_url: string | null;
  bordero_oficial_url: string | null;
  adendo_url: string | null;
  arbitragem: FafArbitragemEntry[];
  alteracoes: FafAlteracaoEntry[];
  updated_at: string;
}

function fromRow(row: MatchFafOficialRow): MatchFafOficial {
  return {
    id: row.id,
    gameRef: row.game_ref,
    competitionId: row.competition_id,
    sumulaUrl: row.sumula_url ?? "",
    borderoOficialUrl: row.bordero_oficial_url ?? "",
    adendoUrl: row.adendo_url ?? "",
    arbitragem: row.arbitragem ?? [],
    alteracoes: row.alteracoes ?? [],
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function toRow(record: MatchFafOficial): MatchFafOficialRow {
  return {
    id: record.id,
    game_ref: record.gameRef,
    competition_id: record.competitionId,
    sumula_url: record.sumulaUrl || null,
    bordero_oficial_url: record.borderoOficialUrl || null,
    adendo_url: record.adendoUrl || null,
    arbitragem: record.arbitragem,
    alteracoes: record.alteracoes,
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

export class MatchFafOficialRepository {
  async get(gameRef: string): Promise<MatchFafOficial | undefined> {
    const { data, error } = await supabase.from("match_faf_oficial").select("*").eq("id", gameRef).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  }

  async listByCompetition(competitionId: string): Promise<MatchFafOficial[]> {
    const { data, error } = await supabase.from("match_faf_oficial").select("*").eq("competition_id", competitionId);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async upsert(record: MatchFafOficial): Promise<void> {
    const { error } = await supabase.from("match_faf_oficial").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(gameRef: string): Promise<void> {
    const { error } = await supabase.from("match_faf_oficial").delete().eq("id", gameRef);
    if (error) throw error;
  }
}

export const matchFafOficialRepository = new MatchFafOficialRepository();
