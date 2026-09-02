import type { Match } from "./dataStore";

const KNOCKOUT_KEYWORDS = ["quartas", "semifinal", "final", "oitavas", "mata-mata", "playoff", "repescagem"];

export function isKnockoutPhase(phase: string | null | undefined): boolean {
  if (!phase) return false;
  const normalized = phase.toLowerCase();
  return KNOCKOUT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * The label that actually says "Semifinal"/"Final" for a match — `phase` when
 * set, otherwise `round`. Matches created through the fórmula de disputa
 * wizard set `phase`; matches typed/imported straight from the FAF's tabela
 * detalhada (which has no separate "fase" column, only "ROD" showing "Final"/
 * "Semifinal" for the knockout rounds) end up with that text in `round`
 * instead, leaving `phase` empty — same knockout match, different field.
 */
export function matchPhaseLabel(match: Pick<Match, "phase" | "round">): string | null {
  return match.phase || match.round || null;
}

/**
 * The leg (Ida/Volta) of a knockout match, or null when the phase isn't
 * knockout or the tie is single-leg (round equal to the phase name itself,
 * e.g. "Oitavas de Final"). `round` holds just the leg marker for a knockout
 * match — either the FAF's own "(Ida)"/"(Volta)" text or a bare ordinal
 * ("1ª"/"2ª") from the wizard, which this maps to leg 1 = Ida, leg 2 = Volta.
 */
export function matchLegLabel(match: Pick<Match, "phase" | "round">): "Ida" | "Volta" | null {
  if (!match.phase || !isKnockoutPhase(match.phase)) return null;
  const round = (match.round || "").toLowerCase();
  if (/volta/.test(round)) return "Volta";
  if (/ida/.test(round)) return "Ida";
  if (/^1/.test(round)) return "Ida";
  if (/^2/.test(round)) return "Volta";
  return null;
}

/**
 * `matchPhaseLabel` plus the leg (Ida/Volta), for display and for the round-image
 * lookup. A non-knockout phase (e.g. "Primeira Fase") just returns the plain
 * round — its `round` is a real numbered round, not a leg.
 */
export function matchPhaseLegLabel(match: Pick<Match, "phase" | "round">): string | null {
  const phase = matchPhaseLabel(match);
  if (!phase) return null;
  if (!match.phase || !isKnockoutPhase(match.phase)) return match.round || phase;

  const leg = matchLegLabel(match);
  return leg ? `${phase} (${leg})` : phase;
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
    const phase = matchPhaseLabel(match);
    if (!isKnockoutPhase(phase)) continue;
    if (!byPhase.has(phase!)) byPhase.set(phase!, []);
    byPhase.get(phase!)!.push(match);
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
