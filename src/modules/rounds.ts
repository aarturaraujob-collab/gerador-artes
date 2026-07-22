import type { Match } from "./dataStore";

/** A round is derived from Match.round, not stored as its own entity (yet). */
export interface RoundSummary {
  round: string;
  matches: Match[];
  finishedCount: number;
  totalCount: number;
}

function isFinished(match: Match): boolean {
  return match.homeGoals !== null && match.awayGoals !== null;
}

/** First-appearance order, unless the round label starts with a number (then sorted numerically). */
function compareRounds(a: string, b: string): number {
  const numA = a.match(/^(\d+)/);
  const numB = b.match(/^(\d+)/);
  if (numA && numB) return Number(numA[1]) - Number(numB[1]);
  if (numA) return -1;
  if (numB) return 1;
  return 0;
}

export function groupMatchesByRound(matches: readonly Match[]): RoundSummary[] {
  const byRound = new Map<string, Match[]>();
  for (const match of matches) {
    const key = match.round || "Sem rodada";
    const list = byRound.get(key);
    if (list) list.push(match);
    else byRound.set(key, [match]);
  }

  return [...byRound.entries()]
    .map(([round, roundMatches]) => ({
      round,
      matches: roundMatches,
      finishedCount: roundMatches.filter(isFinished).length,
      totalCount: roundMatches.length,
    }))
    .sort((a, b) => compareRounds(a.round, b.round));
}
