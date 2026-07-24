import type { Match } from "@/modules/dataStore";

export type DateFilterMode = "all" | "today" | "tomorrow" | "week" | "custom";

export interface DateFilterState {
  mode: DateFilterMode;
  /** Only meaningful when mode === "custom". "YYYY-MM-DD". */
  customIso?: string;
}

export const DEFAULT_DATE_FILTER: DateFilterState = { mode: "all" };

/** `DD/MM/YYYY` -> `YYYY-MM-DD`, comparable lexicographically. Same conversion as dataStore.ts's latestTableDate. */
export function toIsoDate(value: string): string | null {
  const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!parts) return null;
  const [, day, month, year] = parts;
  return `${year}-${month}-${day}`;
}

/** Local YYYY-MM-DD for a Date — never toISOString(), which is UTC and can land on the wrong day near midnight. */
export function dateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIso(): string {
  return dateToIso(new Date());
}

export function tomorrowIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateToIso(date);
}

/** Monday–Sunday of the current week, inclusive. */
export function currentWeekRangeIso(): { start: string; end: string } {
  const now = new Date();
  const weekday = now.getDay(); // 0 = Sunday
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: dateToIso(monday), end: dateToIso(sunday) };
}

export function matchesDateFilter(match: Match, filter: DateFilterState): boolean {
  if (filter.mode === "all") return true;

  const iso = toIsoDate(match.date);
  if (!iso) return false;

  switch (filter.mode) {
    case "today":
      return iso === todayIso();
    case "tomorrow":
      return iso === tomorrowIso();
    case "week": {
      const { start, end } = currentWeekRangeIso();
      return iso >= start && iso <= end;
    }
    case "custom":
      return filter.customIso !== undefined && iso === filter.customIso;
  }
}
