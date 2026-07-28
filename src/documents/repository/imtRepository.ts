import { supabase } from "@/lib/supabaseClient";
import type { GameSnapshot, IMT, IMTStatus } from "../types/imt";
import { formatIMTNumber } from "../types/imt";
import { triggerBlobDownload } from "../utils/downloadBlob";

interface IMTRow {
  id: string;
  competition_id: string;
  competition_name: string;
  game_ref: string;
  home_club_name: string;
  away_club_name: string;
  round: string;
  number: number;
  season: string;
  old_game: GameSnapshot;
  new_game: GameSnapshot;
  reason: string;
  requester: string;
  responsible: string;
  created_at: string;
  status: string;
  html: string;
}

function fromRow(row: IMTRow): IMT {
  return {
    id: row.id,
    competitionId: row.competition_id,
    competitionName: row.competition_name,
    gameRef: row.game_ref,
    homeClubName: row.home_club_name,
    awayClubName: row.away_club_name,
    round: row.round,
    number: row.number,
    season: row.season,
    oldGame: row.old_game,
    newGame: row.new_game,
    reason: row.reason,
    requester: row.requester,
    responsible: row.responsible,
    createdAt: new Date(row.created_at),
    status: row.status as IMTStatus,
    html: row.html,
  };
}

function toRow(imt: IMT): IMTRow {
  return {
    id: imt.id,
    competition_id: imt.competitionId,
    competition_name: imt.competitionName,
    game_ref: imt.gameRef,
    home_club_name: imt.homeClubName,
    away_club_name: imt.awayClubName,
    round: imt.round,
    number: imt.number,
    season: imt.season,
    old_game: imt.oldGame,
    new_game: imt.newGame,
    reason: imt.reason,
    requester: imt.requester,
    responsible: imt.responsible,
    created_at: imt.createdAt.toISOString(),
    status: imt.status,
    html: imt.html,
  };
}

/** Persists and queries IMT documents. This is the only place that knows about the storage mechanism. */
export class IMTRepository {
  async list(): Promise<IMT[]> {
    const { data, error } = await supabase.from("imts").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async get(id: string): Promise<IMT | undefined> {
    const { data, error } = await supabase.from("imts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("imts").delete().eq("id", id);
    if (error) throw error;
  }

  async listBySeason(season: string): Promise<IMT[]> {
    const { data, error } = await supabase.from("imts").select("*").eq("season", season);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  /** All IMTs registered for a competition, newest first — backs the "Documentos" tab. */
  async listByCompetition(competitionId: string): Promise<IMT[]> {
    const { data, error } = await supabase
      .from("imts")
      .select("*")
      .eq("competition_id", competitionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  /** All IMTs ever issued for a given match, newest first — the "consulta futura" the sprint asks for. */
  async listByGameRef(gameRef: string): Promise<IMT[]> {
    const { data, error } = await supabase
      .from("imts")
      .select("*")
      .eq("game_ref", gameRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  /** Next sequential number for the season: highest existing + 1, starting at 1. */
  async nextNumber(season: string): Promise<number> {
    const forSeason = await this.listBySeason(season);
    return forSeason.reduce((max, imt) => Math.max(max, imt.number), 0) + 1;
  }

  async save(imt: IMT): Promise<void> {
    const { error } = await supabase.from("imts").upsert(toRow(imt));
    if (error) throw error;
  }

  /**
   * Re-derives the PDF from the IMT's stored HTML (never from live match
   * data — the whole point of storing `html` is that an old IMT never
   * changes) and triggers a browser download. Throws if the id isn't found.
   *
   * The PDF exporter (jsPDF/html2canvas + document.css) is imported
   * dynamically so that merely listing/reading IMTs never pulls in the
   * rendering stack — only calling download() does.
   */
  async download(id: string): Promise<void> {
    const imt = await this.get(id);
    if (!imt) throw new Error(`IMT "${id}" não encontrada.`);
    const { exportHtmlToPdf } = await import("../pdf/exportDocument");
    const blob = await exportHtmlToPdf(imt.html);
    triggerBlobDownload(blob, `${formatIMTNumber(imt.number, imt.season).replace(/\s+/g, "-")}.pdf`);
  }
}

export const imtRepository = new IMTRepository();
