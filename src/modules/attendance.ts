import type { Match } from "./dataStore";

export interface AttendanceStats {
  totalPublico: number | null;
  totalRenda: number | null;
  /** Matches with a recorded público, biggest first. */
  ranking: Match[];
}

/** Público/renda are optional per match and start empty — every total here is null until at least one match has a value. */
export function computeAttendanceStats(matches: readonly Match[], limit = 5): AttendanceStats {
  const withPublico = matches.filter((match) => match.publico != null);
  const withRenda = matches.filter((match) => match.renda != null);

  return {
    totalPublico: withPublico.length > 0 ? withPublico.reduce((sum, match) => sum + (match.publico ?? 0), 0) : null,
    totalRenda: withRenda.length > 0 ? withRenda.reduce((sum, match) => sum + (match.renda ?? 0), 0) : null,
    ranking: [...withPublico].sort((a, b) => (b.publico ?? 0) - (a.publico ?? 0)).slice(0, limit),
  };
}
