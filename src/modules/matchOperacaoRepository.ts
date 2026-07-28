import { supabase } from "@/lib/supabaseClient";
import type { OperacaoStatus } from "./matchOperationsChecklists";

/** One record per match — `id` is the match's gameRef, so a match has at most one Operação record. */
export interface MatchOperacaoRecord {
  id: string;
  gameRef: string;
  delegadoStaffId: string | null;
  supervisorStaffId: string | null;
  fiscalStaffId: string | null;
  controleAcessoStaffId: string | null;
  checklist: Record<string, boolean>;
  status: OperacaoStatus;
  updatedAt: number;
}

interface MatchOperacaoRow {
  id: string;
  game_ref: string;
  delegado_staff_id: string | null;
  supervisor_staff_id: string | null;
  fiscal_staff_id: string | null;
  controle_acesso_staff_id: string | null;
  checklist: Record<string, boolean>;
  status: string;
  updated_at: string;
}

function fromRow(row: MatchOperacaoRow): MatchOperacaoRecord {
  return {
    id: row.id,
    gameRef: row.game_ref,
    delegadoStaffId: row.delegado_staff_id,
    supervisorStaffId: row.supervisor_staff_id,
    fiscalStaffId: row.fiscal_staff_id,
    controleAcessoStaffId: row.controle_acesso_staff_id,
    checklist: row.checklist ?? {},
    status: row.status as OperacaoStatus,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function toRow(record: MatchOperacaoRecord): MatchOperacaoRow {
  return {
    id: record.id,
    game_ref: record.gameRef,
    delegado_staff_id: record.delegadoStaffId,
    supervisor_staff_id: record.supervisorStaffId,
    fiscal_staff_id: record.fiscalStaffId,
    controle_acesso_staff_id: record.controleAcessoStaffId,
    checklist: record.checklist,
    status: record.status,
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

export class MatchOperacaoRepository {
  async get(gameRef: string): Promise<MatchOperacaoRecord | undefined> {
    const { data, error } = await supabase.from("match_operacao").select("*").eq("id", gameRef).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  }

  async upsert(record: MatchOperacaoRecord): Promise<void> {
    const { error } = await supabase.from("match_operacao").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(gameRef: string): Promise<void> {
    const { error } = await supabase.from("match_operacao").delete().eq("id", gameRef);
    if (error) throw error;
  }
}
