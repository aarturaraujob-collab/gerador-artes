import { supabase } from "@/lib/supabaseClient";
import type {
  DetailedTable,
  DetailedTableRound,
  DetailedTableStandingRow,
  DetailedTableStatus,
} from "../types/detailedTable";
import { formatDetailedTableVersion } from "../types/detailedTable";
import { triggerBlobDownload } from "../utils/downloadBlob";

interface DetailedTableRow {
  id: string;
  competition_id: string;
  competition_name: string;
  season: string;
  version: number;
  status: string;
  created_at: string;
  standings: DetailedTableStandingRow[];
  rounds: DetailedTableRound[];
  html: string;
}

function fromRow(row: DetailedTableRow): DetailedTable {
  return {
    id: row.id,
    competitionId: row.competition_id,
    competitionName: row.competition_name,
    season: row.season,
    version: row.version,
    status: row.status as DetailedTableStatus,
    createdAt: new Date(row.created_at),
    standings: row.standings,
    rounds: row.rounds,
    html: row.html,
  };
}

function toRow(table: DetailedTable): DetailedTableRow {
  return {
    id: table.id,
    competition_id: table.competitionId,
    competition_name: table.competitionName,
    season: table.season,
    version: table.version,
    status: table.status,
    created_at: table.createdAt.toISOString(),
    standings: table.standings,
    rounds: table.rounds,
    html: table.html,
  };
}

/** Persists and queries Tabela Detalhada documents — the only place that knows about the storage mechanism. */
export class DetailedTableRepository {
  async list(): Promise<DetailedTable[]> {
    const { data, error } = await supabase.from("detailed_tables").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async get(id: string): Promise<DetailedTable | undefined> {
    const { data, error } = await supabase.from("detailed_tables").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("detailed_tables").delete().eq("id", id);
    if (error) throw error;
  }

  /** Every version registered for the competition, newest first — backs the "Documentos" tab. */
  async listByCompetition(competitionId: string): Promise<DetailedTable[]> {
    const { data, error } = await supabase
      .from("detailed_tables")
      .select("*")
      .eq("competition_id", competitionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  /** The single CURRENT version for a competition, if one has ever been generated. */
  async getCurrent(competitionId: string): Promise<DetailedTable | undefined> {
    const all = await this.listByCompetition(competitionId);
    return all.find((table) => table.status === "CURRENT");
  }

  /** Next sequential version for the competition: highest existing + 1, starting at 1. */
  async nextVersion(competitionId: string): Promise<number> {
    const all = await this.listByCompetition(competitionId);
    return all.reduce((max, table) => Math.max(max, table.version), 0) + 1;
  }

  /**
   * Persists a new CURRENT version, archiving whatever was CURRENT before it.
   * PostgREST has no multi-row-scan-then-batch-update transaction primitive
   * as convenient as an IndexedDB transaction, so this runs as two sequential
   * calls (archive old, then insert new) rather than one atomic transaction —
   * a brief non-atomic window is accepted here (MVP, single-tenant usage).
   */
  async saveNewVersion(table: DetailedTable): Promise<void> {
    const { error: archiveError } = await supabase
      .from("detailed_tables")
      .update({ status: "ARCHIVED" })
      .eq("competition_id", table.competitionId)
      .eq("status", "CURRENT");
    if (archiveError) throw archiveError;

    const { error: insertError } = await supabase.from("detailed_tables").upsert(toRow(table));
    if (insertError) throw insertError;
  }

  /**
   * Re-derives the PDF from the version's stored HTML (never from live
   * standings/matches — the whole point of storing `html` is that an old
   * version never changes) and triggers a browser download.
   */
  async download(id: string): Promise<void> {
    const table = await this.get(id);
    if (!table) throw new Error(`Tabela Detalhada "${id}" não encontrada.`);
    const { exportHtmlToPdf } = await import("../pdf/exportDocument");
    const blob = await exportHtmlToPdf(table.html);
    triggerBlobDownload(blob, `${formatDetailedTableVersion(table.version, table.season).replace(/\s+/g, "-")}.pdf`);
  }
}

export const detailedTableRepository = new DetailedTableRepository();
