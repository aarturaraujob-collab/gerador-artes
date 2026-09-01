import { supabase } from "@/lib/supabaseClient";

/** One player's aggregated stats for a single competition edition (FAF Lab). */
export interface PlayerCompetitionStats {
  id: string;
  competitionId: string;
  /** CBF registration number, when known — otherwise null. */
  cbf: string | null;
  clubId: string;
  apelido: string;
  nome: string;
  idade: number | null;
  /** Free text — "Contrato Definitivo" / "Contrato Empréstimo" / "Vínculo Não Profissional" / "" (unknown). */
  vinculo: string;
  jogos: number;
  titular: number;
  minutos: number;
  gols: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  entrou: number;
  saiu: number;
  /** Passthrough flags from source data — not surfaced in the UI yet. */
  sub?: boolean;
  estrangeiro?: boolean;
}

interface PlayerStatsRow {
  id: string;
  competition_id: string;
  cbf: string | null;
  club_id: string;
  apelido: string | null;
  nome: string | null;
  idade: number | null;
  vinculo: string | null;
  jogos: number;
  titular: number;
  minutos: number;
  gols: number;
  cartoes_amarelos: number;
  cartoes_vermelhos: number;
  entrou: number;
  saiu: number;
  sub: boolean | null;
  estrangeiro: boolean | null;
}

function fromRow(row: PlayerStatsRow): PlayerCompetitionStats {
  return {
    id: row.id,
    competitionId: row.competition_id,
    cbf: row.cbf,
    clubId: row.club_id,
    apelido: row.apelido ?? "",
    nome: row.nome ?? "",
    idade: row.idade,
    vinculo: row.vinculo ?? "",
    jogos: row.jogos,
    titular: row.titular,
    minutos: row.minutos,
    gols: row.gols,
    cartoesAmarelos: row.cartoes_amarelos,
    cartoesVermelhos: row.cartoes_vermelhos,
    entrou: row.entrou,
    saiu: row.saiu,
    sub: row.sub ?? undefined,
    estrangeiro: row.estrangeiro ?? undefined,
  };
}

function toRow(record: PlayerCompetitionStats): PlayerStatsRow {
  return {
    id: record.id,
    competition_id: record.competitionId,
    cbf: record.cbf,
    club_id: record.clubId,
    apelido: record.apelido || null,
    nome: record.nome || null,
    idade: record.idade,
    vinculo: record.vinculo || null,
    jogos: record.jogos,
    titular: record.titular,
    minutos: record.minutos,
    gols: record.gols,
    cartoes_amarelos: record.cartoesAmarelos,
    cartoes_vermelhos: record.cartoesVermelhos,
    entrou: record.entrou,
    saiu: record.saiu,
    sub: record.sub ?? null,
    estrangeiro: record.estrangeiro ?? null,
  };
}

/**
 * Persists per-player, per-competition stats for the FAF Lab area. Not part
 * of the global reactive DataStore (only one edition is viewed at a time) —
 * pages load it directly, same as backgroundRepository.
 */
export class PlayerStatsRepository {
  async list(): Promise<PlayerCompetitionStats[]> {
    const { data, error } = await supabase.from("player_competition_stats").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  /**
   * Distinct-athlete count across every competition — backs the public FAF
   * Lab header's "Atletas inscritos" total. The same person (same CBF)
   * routinely registers for more than one competition in a season (e.g. an
   * ASA player in both Alagoano and Copa Alagoas), so this must dedupe by
   * CBF rather than counting rows, or it overstates the real headcount.
   * Rows without a CBF on file can't be matched to anyone else, so each
   * counts as its own athlete.
   */
  async countAll(): Promise<number> {
    return this.countForCompetitions(null);
  }

  /**
   * Same dedupe-by-CBF as countAll(), scoped to a set of competitions —
   * backs the public FAF Lab total while some editions are still hidden
   * (competitions.public_visible), so it doesn't count rosters nobody can
   * see yet. Pass null for the unscoped, every-competition count.
   */
  async countForCompetitions(competitionIds: readonly string[] | null): Promise<number> {
    if (competitionIds != null && competitionIds.length === 0) return 0;
    const cbfs = new Set<string>();
    let withoutCbf = 0;
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      let query = supabase.from("player_competition_stats").select("cbf").range(from, from + pageSize - 1);
      if (competitionIds != null) query = query.in("competition_id", competitionIds);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      for (const row of rows) {
        if (row.cbf) cbfs.add(row.cbf);
        else withoutCbf++;
      }
      if (rows.length < pageSize) break;
    }
    return cbfs.size + withoutCbf;
  }

  async listByCompetition(competitionId: string): Promise<PlayerCompetitionStats[]> {
    const { data, error } = await supabase
      .from("player_competition_stats")
      .select("*")
      .eq("competition_id", competitionId);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  /**
   * Atomically replaces every row belonging to `competitionId` — an import
   * wholesale-replaces the edition's roster/stats.
   */
  async replaceForCompetition(competitionId: string, records: readonly PlayerCompetitionStats[]): Promise<void> {
    const { error: deleteError } = await supabase
      .from("player_competition_stats")
      .delete()
      .eq("competition_id", competitionId);
    if (deleteError) throw deleteError;

    if (records.length === 0) return;
    const { error: insertError } = await supabase.from("player_competition_stats").insert(records.map(toRow));
    if (insertError) throw insertError;
  }
}

export const playerStatsRepository = new PlayerStatsRepository();
