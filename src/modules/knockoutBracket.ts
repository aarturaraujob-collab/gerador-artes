import type { Match } from "./dataStore";

const KNOCKOUT_KEYWORDS = ["quartas", "semifinal", "final", "oitavas", "mata-mata", "playoff", "repescagem"];

export function isKnockoutPhase(phase: string | null | undefined): boolean {
  if (!phase) return false;
  const normalized = phase.toLowerCase();
  return KNOCKOUT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export interface BracketLeg {
  homeGoals: number;
  awayGoals: number;
  date: string;
}

export interface BracketTie {
  homeClubId: string;
  awayClubId: string;
  homeAggregate: number;
  awayAggregate: number;
  legs: number;
  decided: boolean;
  /** Individual leg scores, oriented to homeClubId/awayClubId, oldest first — lets the UI expand a tie to show each Ida/Volta result. */
  legDetails: BracketLeg[];
}

export interface BracketPhase {
  phase: string;
  ties: BracketTie[];
}

const PHASE_ORDER = ["Oitavas de Final", "Quartas de Final", "Semifinal", "Final"];

/** "DD/MM/YYYY" → "YYYY-MM-DD", so plain string comparison sorts chronologically. */
function toSortableDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

/**
 * Groups knockout matches into ties (aggregating Ida/Volta legs of the same
 * pair-up) per phase, ordered by the usual knockout progression. Deliberately
 * doesn't attempt to infer bracket connectors (which quarterfinal feeds which
 * semifinal) — that needs explicit slot data this app doesn't track, so
 * phases render as independent columns rather than a connected tree.
 */
export function computeBracket(matches: readonly Match[]): BracketPhase[] {
  const byPhase = new Map<string, Match[]>();
  for (const match of matches) {
    if (!isKnockoutPhase(match.phase)) continue;
    const phase = match.phase!;
    if (!byPhase.has(phase)) byPhase.set(phase, []);
    byPhase.get(phase)!.push(match);
  }

  const orderedPhases = [...byPhase.keys()].sort((a, b) => {
    const ai = PHASE_ORDER.indexOf(a);
    const bi = PHASE_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return byPhase.get(a)![0].date.localeCompare(byPhase.get(b)![0].date);
  });

  return orderedPhases.map((phase) => {
    const ties = new Map<string, BracketTie>();
    for (const match of byPhase.get(phase)!) {
      const key = [match.homeClubId, match.awayClubId].sort().join("|");
      let tie = ties.get(key);
      if (!tie) {
        tie = { homeClubId: match.homeClubId, awayClubId: match.awayClubId, homeAggregate: 0, awayAggregate: 0, legs: 0, decided: false, legDetails: [] };
        ties.set(key, tie);
      }
      if (match.homeGoals != null && match.awayGoals != null) {
        const orientedHome = match.homeClubId === tie.homeClubId;
        const homeGoals = orientedHome ? match.homeGoals : match.awayGoals;
        const awayGoals = orientedHome ? match.awayGoals : match.homeGoals;
        tie.homeAggregate += homeGoals;
        tie.awayAggregate += awayGoals;
        tie.legs += 1;
        tie.legDetails.push({ homeGoals, awayGoals, date: match.date });
      }
    }
    for (const tie of ties.values()) {
      tie.decided = tie.legs > 0 && tie.homeAggregate !== tie.awayAggregate;
      tie.legDetails.sort((a, b) => toSortableDate(a.date).localeCompare(toSortableDate(b.date)));
    }
    return { phase, ties: [...ties.values()] };
  });
}
