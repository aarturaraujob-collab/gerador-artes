import type { Match } from "./dataStore";
import type { Club } from "./clubRepository";
import type { PlayerCompetitionStats } from "./playerStatsRepository";
import { calculateStandings, isFinished } from "./standings";

export interface FafLabKpis {
  atletasInscritos: number;
  entraramEmCampo: number;
  sumulasProcessadas: number;
  golsRegistrados: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  minutosTotais: number;
  idadeMedia: number | null;
  idadeMediaTitulares: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Championship-wide KPIs for the FAF Lab dashboard header. */
export function computeFafLabKpis(players: readonly PlayerCompetitionStats[], matches: readonly Match[]): FafLabKpis {
  const idades = players.map((player) => player.idade).filter((value): value is number => value != null);
  const idadesTitulares = players
    .filter((player) => player.titular > 0)
    .map((player) => player.idade)
    .filter((value): value is number => value != null);

  // Somado das partidas, não dos jogadores — o placar já está lançado na aba
  // Competições bem antes de qualquer súmula por atleta existir, então esse
  // KPI fica correto mesmo antes da estatística individual ser importada.
  // W.O. exclui aqui pelo mesmo motivo que exclui de goalsForOfficial em
  // standings.ts: 3x0 de W.O. não é gol de jogo real.
  const golsDasPartidas = matches.reduce((sum, match) => {
    if (match.homeGoals == null || match.awayGoals == null || match.wo) return sum;
    return sum + match.homeGoals + match.awayGoals;
  }, 0);

  return {
    atletasInscritos: players.length,
    entraramEmCampo: players.filter((player) => player.jogos > 0).length,
    sumulasProcessadas: matches.filter(isFinished).length,
    golsRegistrados: golsDasPartidas,
    cartoesAmarelos: players.reduce((sum, player) => sum + player.cartoesAmarelos, 0),
    cartoesVermelhos: players.reduce((sum, player) => sum + player.cartoesVermelhos, 0),
    minutosTotais: players.reduce((sum, player) => sum + player.minutos, 0),
    idadeMedia: average(idades),
    idadeMediaTitulares: average(idadesTitulares),
  };
}

export interface ClubBreakdown {
  clubId: string;
  clubName: string;
  rosterCount: number;
  jogosDisputados: number;
  golsOficiais: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  idadeMedia: number | null;
}

/**
 * Per-club roster + match breakdown. Jogos disputados/gols oficiais come
 * from calculateStandings() (the same derivation the Classificação tab
 * uses) — the FAF Lab import never re-stores those, to avoid a second
 * source of truth for numbers Match already has.
 */
export function computeClubBreakdown(
  players: readonly PlayerCompetitionStats[],
  matches: readonly Match[],
  clubsById: ReadonlyMap<string, Club>,
): ClubBreakdown[] {
  const standingsByClub = new Map(calculateStandings(matches).map((row) => [row.clubId, row]));

  const clubIds = new Set<string>([...players.map((player) => player.clubId), ...standingsByClub.keys()]);

  return [...clubIds]
    .map((clubId) => {
      const roster = players.filter((player) => player.clubId === clubId);
      const idades = roster.map((player) => player.idade).filter((value): value is number => value != null);
      const standing = standingsByClub.get(clubId);

      return {
        clubId,
        clubName: clubsById.get(clubId)?.shortName ?? clubId,
        rosterCount: roster.length,
        jogosDisputados: standing?.played ?? 0,
        golsOficiais: standing?.goalsFor ?? 0,
        cartoesAmarelos: roster.reduce((sum, player) => sum + player.cartoesAmarelos, 0),
        cartoesVermelhos: roster.reduce((sum, player) => sum + player.cartoesVermelhos, 0),
        idadeMedia: average(idades),
      };
    })
    .sort((a, b) => a.clubName.localeCompare(b.clubName, "pt-BR"));
}
