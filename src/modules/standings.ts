import type { Match } from "./dataStore";

export interface StandingsRow {
  clubId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface ClubTopStat {
  clubId: string;
  value: number;
}

export interface CompetitionStats {
  topAttack: ClubTopStat | null;
  bestDefense: ClubTopStat | null;
  mostWins: ClubTopStat | null;
  mostDraws: ClubTopStat | null;
  mostLosses: ClubTopStat | null;
  /** % (0-100) of finished matches won by the home side. Null if no finished matches. */
  homeWinRate: number | null;
  /** % (0-100) of finished matches won by the away side. Null if no finished matches. */
  awayWinRate: number | null;
  /** Estrutura preparada — sem dados de gol por jogador na base hoje. */
  topScorers: { clubId: string; goals: number }[];
}

function isFinished(match: Match): boolean {
  return match.homeGoals !== null && match.awayGoals !== null;
}

/** Classificação (P/J/V/E/D/GP/GC/SG/PTS), considerando apenas jogos com placar lançado. */
export function calculateStandings(matches: readonly Match[]): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();

  function ensure(clubId: string): StandingsRow {
    let row = rows.get(clubId);
    if (!row) {
      row = { clubId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
      rows.set(clubId, row);
    }
    return row;
  }

  for (const match of matches) {
    if (!isFinished(match)) continue;
    const homeGoals = match.homeGoals as number;
    const awayGoals = match.awayGoals as number;

    const home = ensure(match.homeClubId);
    const away = ensure(match.awayClubId);

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (homeGoals < awayGoals) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  return [...rows.values()].sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.clubId.localeCompare(b.clubId),
  );
}

function topBy<T>(rows: StandingsRow[], select: (row: StandingsRow) => number, minIsBest = false): ClubTopStat | null {
  if (rows.length === 0) return null;
  const best = rows.reduce((leader, row) => {
    const value = select(row);
    const leaderValue = select(leader);
    return (minIsBest ? value < leaderValue : value > leaderValue) ? row : leader;
  });
  return { clubId: best.clubId, value: select(best) };
}

/** Estatísticas gerais da competição, derivadas da classificação e dos jogos finalizados. */
export function calculateStats(matches: readonly Match[]): CompetitionStats {
  const standings = calculateStandings(matches);
  const finished = matches.filter(isFinished);

  const homeWins = finished.filter((m) => (m.homeGoals as number) > (m.awayGoals as number)).length;
  const awayWins = finished.filter((m) => (m.awayGoals as number) > (m.homeGoals as number)).length;

  return {
    topAttack: topBy(standings, (row) => row.goalsFor),
    bestDefense: topBy(standings.filter((row) => row.played > 0), (row) => row.goalsAgainst, true),
    mostWins: topBy(standings, (row) => row.wins),
    mostDraws: topBy(standings, (row) => row.draws),
    mostLosses: topBy(standings, (row) => row.losses),
    homeWinRate: finished.length > 0 ? Math.round((homeWins / finished.length) * 100) : null,
    awayWinRate: finished.length > 0 ? Math.round((awayWins / finished.length) * 100) : null,
    topScorers: [],
  };
}
