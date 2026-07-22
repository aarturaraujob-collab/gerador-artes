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

/** Flat view of an IMT's fields the template placeholders map onto 1:1. */
export interface IMTPlaceholders {
  competition: string;
  season: string;
  imtNumber: string;
  home: string;
  away: string;
  oldDate: string;
  newDate: string;
  oldTime: string;
  newTime: string;
  oldStadium: string;
  newStadium: string;
  requester: string;
  reason: string;
  responsible: string;
  createdAt: string;
}

/** Builds the placeholder map from an (unsaved) IMT — the sole bridge between the domain shape and the template. */
export function toPlaceholders(imt: Pick<IMT,
  "competitionName" | "season" | "number" | "homeClubName" | "awayClubName" |
  "oldGame" | "newGame" | "requester" | "reason" | "responsible" | "createdAt"
>): IMTPlaceholders {
  return {
    competition: imt.competitionName,
    season: imt.season,
    imtNumber: formatIMTNumber(imt.number, imt.season),
    home: imt.homeClubName,
    away: imt.awayClubName,
    oldDate: imt.oldGame.date,
    newDate: imt.newGame.date,
    oldTime: imt.oldGame.time,
    newTime: imt.newGame.time,
    oldStadium: `${imt.oldGame.stadiumName} — ${imt.oldGame.cityName}`,
    newStadium: `${imt.newGame.stadiumName} — ${imt.newGame.cityName}`,
    requester: imt.requester,
    reason: imt.reason,
    responsible: imt.responsible,
    createdAt: imt.createdAt.toLocaleDateString("pt-BR"),
  };
}
