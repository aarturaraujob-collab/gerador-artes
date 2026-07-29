import type { Match } from "./dataStore";

export interface SeasonProgress {
  start: Date;
  end: Date;
  /** 0-100, clamped — where "now" falls between the first and last scheduled match. */
  percent: number;
}

function parseDate(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Season date range spanned by a competition's fixtures, and how far "now" is through it. */
export function computeSeasonProgress(matches: readonly Match[], now: Date): SeasonProgress | null {
  const dates = matches.map((match) => parseDate(match.date)).filter((date): date is Date => date !== null);
  if (dates.length === 0) return null;

  const start = new Date(Math.min(...dates.map((d) => d.getTime())));
  const end = new Date(Math.max(...dates.map((d) => d.getTime())));
  const total = end.getTime() - start.getTime();
  const percent = total > 0 ? Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / total) * 100)) : 100;

  return { start, end, percent };
}
