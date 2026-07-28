import { supabase } from "@/lib/supabaseClient";

export type MatchOperationsModule = "faftv" | "operacao";

export interface MatchHistoryEntry {
  id: string;
  gameRef: string;
  module: MatchOperationsModule;
  operator: string;
  description: string;
  timestamp: number;
}

interface MatchHistoryRow {
  id: string;
  game_ref: string;
  module: string;
  operator: string;
  description: string;
  timestamp: string;
}

function fromRow(row: MatchHistoryRow): MatchHistoryEntry {
  return {
    id: row.id,
    gameRef: row.game_ref,
    module: row.module as MatchOperationsModule,
    operator: row.operator,
    description: row.description,
    timestamp: new Date(row.timestamp).getTime(),
  };
}

function toRow(entry: MatchHistoryEntry): MatchHistoryRow {
  return {
    id: entry.id,
    game_ref: entry.gameRef,
    module: entry.module,
    operator: entry.operator,
    description: entry.description,
    timestamp: new Date(entry.timestamp).toISOString(),
  };
}

/**
 * Per-match audit trail (CP6) — separate from the global, 50-entry-capped
 * `activityLog.ts`, since this one must be uncapped and scoped per match.
 */
export class MatchOperationsHistoryRepository {
  async listByGameRef(gameRef: string): Promise<MatchHistoryEntry[]> {
    const { data, error } = await supabase
      .from("match_operations_history")
      .select("*")
      .eq("game_ref", gameRef)
      .order("timestamp", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async append(entry: MatchHistoryEntry): Promise<void> {
    const { error } = await supabase.from("match_operations_history").insert(toRow(entry));
    if (error) throw error;
  }
}
