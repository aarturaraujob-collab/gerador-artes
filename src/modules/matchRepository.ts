import { supabase } from "@/lib/supabaseClient";
import { buildGameRef } from "./gameRef";
import type { Match } from "./dataStore";

/** A Match as stored in Postgres — same shape, plus the gameRef-derived `id` the table keys on. */
export type StoredMatch = Match & { id: string };

function toStored(match: Match): StoredMatch {
  return { ...match, id: buildGameRef(match) };
}

interface MatchRow {
  id: string;
  competition_id: string;
  round: string | null;
  date: string | null;
  time: string | null;
  home_club_id: string;
  away_club_id: string;
  stadium_id: string | null;
  city_id: string | null;
  home_goals: number | null;
  away_goals: number | null;
  tv: string | null;
  phase: string | null;
  ref: string | null;
}

function fromRow(row: MatchRow): StoredMatch {
  return {
    id: row.id,
    competitionId: row.competition_id,
    round: row.round ?? "",
    date: row.date ?? "",
    time: row.time ?? "",
    homeClubId: row.home_club_id,
    awayClubId: row.away_club_id,
    stadiumId: row.stadium_id ?? "",
    cityId: row.city_id ?? "",
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    tv: row.tv,
    phase: row.phase,
    ref: row.ref,
  };
}

function toRow(match: StoredMatch): MatchRow {
  return {
    id: match.id,
    competition_id: match.competitionId,
    round: match.round || null,
    date: match.date || null,
    time: match.time || null,
    home_club_id: match.homeClubId,
    away_club_id: match.awayClubId,
    stadium_id: match.stadiumId || null,
    city_id: match.cityId || null,
    home_goals: match.homeGoals,
    away_goals: match.awayGoals,
    tv: match.tv,
    phase: match.phase ?? null,
    ref: match.ref ?? null,
  };
}

/** Persists match records in Supabase (Postgres table "matches", RLS: any authenticated user). */
export class MatchRepository {
  async list(): Promise<StoredMatch[]> {
    const { data, error } = await supabase.from("matches").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  /** First-run only: if the table is empty, seeds it from the bundled schedule. */
  async seedIfEmpty(seed: readonly Match[]): Promise<StoredMatch[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;
    if (seed.length === 0) return [];

    const { error } = await supabase.from("matches").insert(seed.map((record) => toRow(toStored(record))));
    if (error) throw error;
    return seed.map(toStored);
  }

  /**
   * Persists an edit to one match. `gameRef` is derived from round/date/time/
   * clubs (see gameRef.ts), so changing any of those changes the stored id.
   * Only upserts the new row here — the caller (dataStore.updateMatch) is
   * responsible for migrating FAFTV/Operação/Histórico off the old id (they
   * FK-reference matches.id) and removing the old row afterwards; deleting
   * it here, before that migration runs, would violate those FKs.
   */
  async update(previous: Match, next: Match): Promise<void> {
    const { error } = await supabase.from("matches").upsert(toRow(toStored(next)));
    if (error) throw error;
  }

  /** Removes one match row by its gameRef-derived id. */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) throw error;
  }

  /**
   * Atomically replaces every match belonging to `competitionId` with
   * `records` — matches an import wholesale-replacing a competition's
   * schedule, not merging row by row.
   */
  async replaceForCompetition(competitionId: string, records: readonly Match[]): Promise<void> {
    const { error: deleteError } = await supabase.from("matches").delete().eq("competition_id", competitionId);
    if (deleteError) throw deleteError;

    if (records.length === 0) return;
    const { error: insertError } = await supabase.from("matches").insert(records.map((record) => toRow(toStored(record))));
    if (insertError) throw insertError;
  }
}

export const matchRepository = new MatchRepository();
