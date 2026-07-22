import type { CompetitionRecord } from "./competitionRepository";
import type { Match } from "./dataStore";

export type CompetitionStatus = "A acontecer" | "Em andamento" | "Finalizada" | "Arquivada";

export const COMPETITION_STATUSES: readonly CompetitionStatus[] = [
  "A acontecer",
  "Em andamento",
  "Finalizada",
  "Arquivada",
];

export const STATUS_TONE: Record<CompetitionStatus, "info" | "success" | "neutral"> = {
  "A acontecer": "info",
  "Em andamento": "success",
  "Finalizada": "neutral",
  "Arquivada": "neutral",
};

export function parseMatchDate(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Suggests a status purely from the competition's match dates vs. today. */
export function suggestStatusFromDates(matches: readonly Match[]): CompetitionStatus {
  const dates = matches
    .map((match) => parseMatchDate(match.date))
    .filter((date): date is Date => date !== null);

  if (dates.length === 0) return "A acontecer";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allFuture = dates.every((date) => date.getTime() > today.getTime());
  if (allFuture) return "A acontecer";

  const allPast = dates.every((date) => date.getTime() < today.getTime());
  if (allPast) return "Finalizada";

  return "Em andamento";
}

/**
 * Resolves the status to display: an explicit `status` set by the user
 * always wins; an archived (`active: false`) competition is always
 * "Arquivada" regardless of dates; otherwise the status is suggested
 * automatically from the imported match dates.
 */
export function resolveCompetitionStatus(
  record: CompetitionRecord,
  matches: readonly Match[],
): CompetitionStatus {
  if (record.status) return record.status;
  if (!record.active) return "Arquivada";
  return suggestStatusFromDates(matches);
}
