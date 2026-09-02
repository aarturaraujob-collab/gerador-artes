/**
 * IMT (Informação de Modificação de Tabela) — domain types.
 *
 * This module is intentionally self-contained: it does not import from
 * src/modules/dataStore.ts or any other existing domain module. Callers
 * (the UI layer) are responsible for reading whatever they need from the
 * existing Match/Competition/Club/Stadium data and passing plain values in.
 */

/** A frozen photograph of the parts of a match that an IMT can change. The
 * document is never re-derived from a live match lookup later — if the
 * match record changes or is deleted, already-issued IMTs must still read
 * exactly as they did the day they were generated. */
export interface GameSnapshot {
  date: string;
  time: string;
  stadiumName: string;
  cityName: string;
}

export type IMTStatus = "draft" | "generated";

export interface IMT {
  id: string;
  competitionId: string;
  /** Snapshot — never re-fetch the competition to redisplay an old IMT. */
  competitionName: string;
  /** Composite match identity (Match has no id field): "competitionId|round|date|time|homeClubId|awayClubId". */
  gameRef: string;
  /** Snapshots — fixed for the document, not part of the old/new diff. */
  homeClubName: string;
  awayClubName: string;
  round: string;
  /** External match reference (the REF column from the official schedule), if known — shown as "Jogo: {ref} ...". */
  matchRef?: string | null;
  /** Sequential number within `season`, starting at 1 (see nextIMTNumber). */
  number: number;
  season: string;
  oldGame: GameSnapshot;
  newGame: GameSnapshot;
  reason: string;
  requester: string;
  responsible: string;
  createdAt: Date;
  status: IMTStatus;
  /** The exact rendered HTML used for the PDF — registered for future lookup, never recomputed. */
  html: string;
}

/** Formats "IMT 001/2026" — 3-digit zero-padded sequence, per-season. */
export function formatIMTNumber(number: number, season: string): string {
  return `IMT ${String(number).padStart(3, "0")}/${season}`;
}

/** Formats "IMT – 03/26" — the short form used on the official document header (2-digit sequence, 2-digit year). */
export function formatIMTShortNumber(number: number, season: string): string {
  return `IMT – ${String(number).padStart(2, "0")}/${season.slice(-2)}`;
}

const WEEKDAYS_PT_BR = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** "DD/MM/AAAA" → "Terça-feira" (or "" if the date is missing/malformed — dates aren't always known yet for TBD fixtures). */
function weekdayPtBr(date: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  if (!match) return "";
  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return WEEKDAYS_PT_BR[parsed.getDay()] ?? "";
}

/** Flat view of an IMT's fields the template placeholders map onto 1:1. */
export interface IMTPlaceholders {
  competition: string;
  competitionUpper: string;
  season: string;
  imtNumber: string;
  ref: string;
  home: string;
  away: string;
  oldDate: string;
  oldWeekday: string;
  newDate: string;
  newWeekday: string;
  newTime: string;
  timeStatus: string;
  newStadium: string;
  stadiumStatus: string;
  requester: string;
  reason: string;
  issueDate: string;
  createdStamp: string;
}

/** Builds the placeholder map from an (unsaved) IMT — the sole bridge between the domain shape and the template. */
export function toPlaceholders(imt: Pick<IMT,
  "competitionName" | "season" | "number" | "homeClubName" | "awayClubName" |
  "matchRef" | "oldGame" | "newGame" | "requester" | "reason" | "createdAt"
>): IMTPlaceholders {
  const stadiumChanged = imt.oldGame.stadiumName !== imt.newGame.stadiumName || imt.oldGame.cityName !== imt.newGame.cityName;
  const timeChanged = imt.oldGame.time !== imt.newGame.time;

  return {
    competition: imt.competitionName,
    competitionUpper: imt.competitionName.toUpperCase(),
    season: imt.season,
    imtNumber: formatIMTShortNumber(imt.number, imt.season),
    ref: imt.matchRef ?? "",
    home: imt.homeClubName,
    away: imt.awayClubName,
    oldDate: imt.oldGame.date,
    oldWeekday: weekdayPtBr(imt.oldGame.date),
    newDate: imt.newGame.date,
    newWeekday: weekdayPtBr(imt.newGame.date),
    newTime: imt.newGame.time,
    timeStatus: timeChanged ? "alterado" : "mantido",
    newStadium: `${imt.newGame.stadiumName}, em ${imt.newGame.cityName}/AL`,
    stadiumStatus: stadiumChanged ? "alterado" : "mantido",
    requester: imt.requester,
    reason: imt.reason,
    issueDate: imt.createdAt.toLocaleDateString("pt-BR"),
    createdStamp: `${imt.createdAt.toLocaleDateString("pt-BR")} às ${imt.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
  };
}
