/**
 * Tabela Detalhada — domain types.
 *
 * Same philosophy as src/documents/types/imt.ts: a frozen snapshot (standings
 * + rounds resolved to plain names, never a live club/match lookup), so an
 * already-issued version reads exactly as it did the day it was generated,
 * even if the underlying matches change later or the competition is deleted.
 *
 * Unlike IMT, only one version per competition is ever "current" — every
 * new version generated archives whatever was current before (see
 * detailedTableRepository.saveNewVersion).
 */

export type DetailedTableStatus = "CURRENT" | "ARCHIVED";

export interface DetailedTableStandingRow {
  clubName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface DetailedTableRoundMatch {
  homeClubName: string;
  awayClubName: string;
  date: string;
  time: string;
  stadiumName: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface DetailedTableRound {
  round: string;
  matches: DetailedTableRoundMatch[];
}

export interface DetailedTable {
  id: string;
  competitionId: string;
  /** Snapshot — never re-fetch the competition to redisplay an old version. */
  competitionName: string;
  season: string;
  /** Sequential version number within the competition, starting at 1 (see nextVersion). */
  version: number;
  status: DetailedTableStatus;
  createdAt: Date;
  standings: DetailedTableStandingRow[];
  rounds: DetailedTableRound[];
  /** The exact rendered HTML used for the PDF — registered for future lookup, never recomputed. */
  html: string;
}

/** Formats "Tabela Detalhada v3 — 2026". */
export function formatDetailedTableVersion(version: number, season: string): string {
  return `Tabela Detalhada v${version} — ${season}`;
}
