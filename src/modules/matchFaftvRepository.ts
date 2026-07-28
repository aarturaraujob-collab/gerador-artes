import { supabase } from "@/lib/supabaseClient";
import type { FaftvStatus } from "./matchOperationsChecklists";

/** One record per match — `id` is the match's gameRef, so a match has at most one FAFTV record. */
export interface MatchFaftvRecord {
  id: string;
  gameRef: string;
  coordinatorStaffId: string | null;
  commentatorStaffId: string | null;
  broadcastLink: string;
  checklist: Record<string, boolean>;
  status: FaftvStatus;
  updatedAt: number;
}

interface MatchFaftvRow {
  id: string;
  game_ref: string;
  coordinator_staff_id: string | null;
  commentator_staff_id: string | null;
  broadcast_link: string | null;
  checklist: Record<string, boolean>;
  status: string;
  updated_at: string;
}

function fromRow(row: MatchFaftvRow): MatchFaftvRecord {
  return {
    id: row.id,
    gameRef: row.game_ref,
    coordinatorStaffId: row.coordinator_staff_id,
    commentatorStaffId: row.commentator_staff_id,
    broadcastLink: row.broadcast_link ?? "",
    checklist: row.checklist ?? {},
    status: row.status as FaftvStatus,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function toRow(record: MatchFaftvRecord): MatchFaftvRow {
  return {
    id: record.id,
    game_ref: record.gameRef,
    coordinator_staff_id: record.coordinatorStaffId,
    commentator_staff_id: record.commentatorStaffId,
    broadcast_link: record.broadcastLink || null,
    checklist: record.checklist,
    status: record.status,
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

export class MatchFaftvRepository {
  async get(gameRef: string): Promise<MatchFaftvRecord | undefined> {
    const { data, error } = await supabase.from("match_faftv").select("*").eq("id", gameRef).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  }

  async upsert(record: MatchFaftvRecord): Promise<void> {
    const { error } = await supabase.from("match_faftv").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(gameRef: string): Promise<void> {
    const { error } = await supabase.from("match_faftv").delete().eq("id", gameRef);
    if (error) throw error;
  }
}
