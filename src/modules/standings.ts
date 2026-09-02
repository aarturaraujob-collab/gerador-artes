import type { Match } from "./dataStore";
import { isPlaceholderClubId } from "./clubDisplay";

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
  /**
   * Same as goalsFor/goalsAgainst, but excluding W.O. matches (see
   * Match.wo) — used for "ataque mais positivo"/"defesa mais sólida"
   * rankings, which shouldn't credit a club with goals nobody actually
   * scored. goalsFor/goalsAgainst (and the goalDifference tiebreak in the
   * classificação table) still count W.O. goals normally.
   */
  goalsForOfficial: number;
  goalsAgainstOfficial: number;
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

export function isFinished(match: Match): boolean {
  return match.homeGoals !== null && match.awayGoals !== null;
}

/**
 * Classificação (P/J/V/E/D/GP/GC/SG/PTS). Toda equipe real escalada em algum
 * jogo da competição aparece, mesmo com 0 partidas disputadas — só as
 * estatísticas (V/E/D/GP/GC/PTS) vêm exclusivamente de jogos com placar
 * lançado; vagas de mata-mata ainda não definidas ("1º Colocado" etc.) nunca
 * entram na tabela.
 */
export function calculateStandings(matches: readonly Match[]): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();

  function ensure(clubId: string): StandingsRow {
    let row = rows.get(clubId);
    if (!row) {
      row = {
        clubId,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        goalsForOfficial: 0,
        goalsAgainstOfficial: 0,
      };
      rows.set(clubId, row);
    }
    return row;
  }

  // Every real (non-placeholder) club scheduled in the competition gets a row
  // from the start, at 0 games — not just clubs that already have a finished
  // match. TBD knockout slots ("1º Colocado" etc.) never get a row: they're
  // not real clubs, and their fixtures have no result to rank by anyway.
  for (const match of matches) {
    if (!isPlaceholderClubId(match.homeClubId)) ensure(match.homeClubId);
    if (!isPlaceholderClubId(match.awayClubId)) ensure(match.awayClubId);
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
    if (!match.wo) {
      home.goalsForOfficial += homeGoals;
      home.goalsAgainstOfficial += awayGoals;
      away.goalsForOfficial += awayGoals;
      away.goalsAgainstOfficial += homeGoals;
    }

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

  // Only clubs with at least one finished match count — otherwise a
  // competition with fixtures scheduled but no results yet would surface some
  // arbitrary club sitting at 0 as a fake "leader" instead of showing no data.
  const played = standings.filter((row) => row.played > 0);

  return {
    topAttack: topBy(played, (row) => row.goalsForOfficial),
    bestDefense: topBy(played, (row) => row.goalsAgainstOfficial, true),
    mostWins: topBy(played, (row) => row.wins),
    mostDraws: topBy(played, (row) => row.draws),
    mostLosses: topBy(played, (row) => row.losses),
    homeWinRate: finished.length > 0 ? Math.round((homeWins / finished.length) * 100) : null,
    awayWinRate: finished.length > 0 ? Math.round((awayWins / finished.length) * 100) : null,
    topScorers: [],
  };
}

function parseMatchDate(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Last `limit` finished results for a club, oldest to newest — "V"/"E"/"D" (vitória/empate/derrota), sofascore-style form strip. */
export function getRecentForm(clubId: string, matches: readonly Match[], limit = 5): ("V" | "E" | "D")[] {
  const finished = matches
    .filter((match) => isFinished(match) && (match.homeClubId === clubId || match.awayClubId === clubId))
    .map((match) => ({ match, date: parseMatchDate(match.date) }))
    .filter((entry): entry is { match: Match; date: Date } => entry.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return finished.slice(-limit).map(({ match }) => {
    const isHome = match.homeClubId === clubId;
    const goalsFor = (isHome ? match.homeGoals : match.awayGoals) as number;
    const goalsAgainst = (isHome ? match.awayGoals : match.homeGoals) as number;
    if (goalsFor > goalsAgainst) return "V";
    if (goalsFor < goalsAgainst) return "D";
    return "E";
  });
}
