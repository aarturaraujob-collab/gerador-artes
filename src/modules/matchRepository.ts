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
  bracket_slot: string | null;
  penalty_home_goals: number | null;
  penalty_away_goals: number | null;
  wo: boolean | null;
  // NOTE: `publico`/`renda` exist on the in-memory Match type (and are read
  // by the FAF Lab attendance dashboard) but the live "matches" table has no
  // such columns yet (see supabase/schema.sql) — sending them in an
  // insert/upsert payload makes PostgREST reject the *entire* write with
  // "Could not find the '...' column ... in the schema cache", breaking
  // every score edit, reschedule and reimport. Omitted here until that
  // migration is applied; do not add them back without it.
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
    bracketSlot: row.bracket_slot,
    penaltyHomeGoals: row.penalty_home_goals,
    penaltyAwayGoals: row.penalty_away_goals,
    wo: row.wo ?? false,
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
    bracket_slot: match.bracketSlot ?? null,
    penalty_home_goals: match.penaltyHomeGoals ?? null,
    penalty_away_goals: match.penaltyAwayGoals ?? null,
    wo: match.wo ?? false,
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

  /** Every match id currently stored for a competition — used to diff an import against what's already there. */
  async listIdsForCompetition(competitionId: string): Promise<string[]> {
    const { data, error } = await supabase.from("matches").select("id").eq("competition_id", competitionId);
    if (error) throw error;
    return (data ?? []).map((row) => row.id as string);
  }

  /**
   * Replaces every match belonging to `competitionId` with `records` — an
   * import wholesale-replacing a competition's schedule. Upserts instead of
   * delete-then-insert so a match whose identity (round/date/time/clubs, and
   * therefore id) didn't change keeps its row — and the FAFTV/Operação/
   * Arbitragem/Escala/Histórico rows FK-referencing it — intact across a
   * reimport. Only ids that genuinely disappear from the new import are
   * deleted; the caller (dataStore.mergeMatches) is responsible for clearing
   * those matches' operational rows first, the same way updateMatch does for
   * a single reschedule — otherwise this delete violates their FKs.
   */
  async replaceForCompetition(competitionId: string, records: readonly Match[]): Promise<void> {
    const stored = records.map((record) => toStored(record));
    const keepIds = new Set(stored.map((record) => record.id));

    const existingIds = await this.listIdsForCompetition(competitionId);

    // A parse/scrape that comes back with zero valid rows (empty file,
    // unreachable source, every row missing home/away) must never be read as
    // "this competition now has no matches" — that's how a bad CSV or a
    // flaky FAF fetch wipes an entire schedule. Only an explicit, dedicated
    // action (not a side effect of importing nothing) should ever do that.
    if (stored.length === 0 && existingIds.length > 0) {
      throw new Error(
        "A importação não trouxe nenhum jogo válido — os jogos já cadastrados desta competição não foram apagados. Confira o arquivo ou a fonte e tente de novo.",
      );
    }

    const idsToRemove = existingIds.filter((id) => !keepIds.has(id));

    if (idsToRemove.length > 0) {
      const { error: deleteError } = await supabase.from("matches").delete().in("id", idsToRemove);
      if (deleteError) throw deleteError;
    }

    if (stored.length === 0) return;
    const { error: upsertError } = await supabase.from("matches").upsert(stored.map(toRow));
    if (upsertError) throw upsertError;
  }
}

export const matchRepository = new MatchRepository();
