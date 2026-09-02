import { supabase } from "@/lib/supabaseClient";

/**
 * One record per match — `id` is the match's gameRef, so a match has at most
 * one borderô. Only público pagante/total are worth structuring; everything
 * else on the real Boletim Financeiro (receita por setor, B1/B2/B3, INSS,
 * divisão de renda entre clubes) just lives in the imported PDF itself.
 */
export interface MatchBordero {
  id: string;
  gameRef: string;
  competitionId: string;
  publicoPagante: number | null;
  publicoTotal: number | null;
  observacoes: string;
  documentoNome: string;
  documentoDataUri: string;
  status: "preenchido" | "nao_aplicavel";
  updatedAt: number;
}

interface MatchBorderoRow {
  id: string;
  game_ref: string;
  competition_id: string;
  publico_pagante: number | null;
  publico_total: number | null;
  observacoes: string | null;
  documento_nome: string | null;
  documento_data_uri: string | null;
  status: string;
  updated_at: string;
}

function fromRow(row: MatchBorderoRow): MatchBordero {
  return {
    id: row.id,
    gameRef: row.game_ref,
    competitionId: row.competition_id,
    publicoPagante: row.publico_pagante,
    publicoTotal: row.publico_total,
    observacoes: row.observacoes ?? "",
    documentoNome: row.documento_nome ?? "",
    documentoDataUri: row.documento_data_uri ?? "",
    status: row.status as MatchBordero["status"],
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function toRow(record: MatchBordero): MatchBorderoRow {
  return {
    id: record.id,
    game_ref: record.gameRef,
    competition_id: record.competitionId,
    publico_pagante: record.publicoPagante,
    publico_total: record.publicoTotal,
    observacoes: record.observacoes || null,
    documento_nome: record.documentoNome || null,
    documento_data_uri: record.documentoDataUri || null,
    status: record.status,
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

export class MatchBorderoRepository {
  async get(gameRef: string): Promise<MatchBordero | undefined> {
    const { data, error } = await supabase.from("match_borderos").select("*").eq("id", gameRef).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  }

  async upsert(record: MatchBordero): Promise<void> {
    const { error } = await supabase.from("match_borderos").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(gameRef: string): Promise<void> {
    const { error } = await supabase.from("match_borderos").delete().eq("id", gameRef);
    if (error) throw error;
  }
}

export const matchBorderoRepository = new MatchBorderoRepository();
