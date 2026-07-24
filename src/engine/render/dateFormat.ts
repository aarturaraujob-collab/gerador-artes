const WEEKDAYS = [
  "DOMINGO",
  "SEGUNDA-FEIRA",
  "TERÇA-FEIRA",
  "QUARTA-FEIRA",
  "QUINTA-FEIRA",
  "SEXTA-FEIRA",
  "SÁBADO",
];

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export interface ParsedMatchDate {
  weekday: string;
  day: string;
  month: string;
}

/** Parses a `DD/MM/YYYY` match date into its weekday/day/month parts, in Portuguese. */
export function parseMatchDate(value: string): ParsedMatchDate {
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parts) return { weekday: "", day: value, month: "" };
  const [, day, month, year] = parts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return { weekday: WEEKDAYS[date.getDay()], day: String(Number(day)), month: MONTHS[date.getMonth()] };
}

/** Standardized date badge, e.g. "25/JUL" — used everywhere a date-shaped field is rendered (CP2). */
export function formatDateBadge(date: ParsedMatchDate): string {
  if (!date.month) return date.day;
  return `${date.day.padStart(2, "0")}/${date.month}`;
}

/** Header line, e.g. "SÁBADO (01/JAN)" — full weekday name, never an abbreviation (CP1). */
export function formatHeader(date: ParsedMatchDate): string {
  if (!date.weekday) return date.day;
  return `${date.weekday} (${formatDateBadge(date)})`;
}
