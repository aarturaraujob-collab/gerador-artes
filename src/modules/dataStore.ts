import slugify from "slugify";

import { cities as cityRows } from "../../tables/cities";
import { clubs as clubRows } from "../../tables/clubs";
import { matches as matchRows } from "../../tables/matches";
import { stadiums as stadiumRows } from "../../tables/stadiums";
import {
  CompetitionRepository,
  emptyBackground,
  type BackgroundAssets,
  type CompetitionRecord,
} from "./competitionRepository";

export type { BackgroundAssets, CompetitionRecord };
/** Alias kept for callers that only need the competition shape, not the repository. */
export type Competition = CompetitionRecord;

export interface Club {
  id: string;
  shortName: string;
  fullName: string;
  shield: string;
}

export interface City {
  id: string;
  name: string;
}

export interface Stadium {
  id: string;
  name: string;
  cityId: string;
}

export interface Match {
  competitionId: string;
  round: string;
  date: string;
  time: string;
  homeClubId: string;
  awayClubId: string;
  stadiumId: string;
  cityId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  tv: string | null;
}

/** One normalized row produced by the spreadsheet importer. */
export interface ExtractedRow {
  round: string | null;
  date: string | null;
  time: string | null;
  home: string | null;
  away: string | null;
  stadium: string | null;
  city: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  tv: string | null;
}

/** Immutable read model shared by the UI and the engine. */
export interface DataStore {
  competitions: readonly Competition[];
  clubs: readonly Club[];
  cities: readonly City[];
  stadiums: readonly Stadium[];
  matches: readonly Match[];
  clubsById: ReadonlyMap<string, Club>;
  citiesById: ReadonlyMap<string, City>;
  stadiumsById: ReadonlyMap<string, Stadium>;
  lastUpdated: string;
}

interface Snapshot {
  competitions: Competition[];
  clubs: Club[];
  cities: City[];
  stadiums: Stadium[];
  matches: Match[];
  clubsById: Map<string, Club>;
  citiesById: Map<string, City>;
  stadiumsById: Map<string, Stadium>;
  lastUpdated: string;
}

function slug(value: string): string {
  return slugify(value, { lower: true, strict: true, trim: true });
}

function latestTableDate(matches: readonly Match[]): string {
  const dates = matches
    .map((match) => match.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))
    .filter((parts): parts is RegExpMatchArray => parts !== null)
    .map(([, day, month, year]) => `${year}-${month}-${day}`)
    .sort();
  return dates[dates.length - 1] ?? "—";
}

function buildSnapshot(
  competitions: Competition[],
  clubs: Club[],
  cities: City[],
  stadiums: Stadium[],
  matches: Match[],
): Snapshot {
  return {
    competitions,
    clubs,
    cities,
    stadiums,
    matches,
    clubsById: new Map(clubs.map((club) => [club.id, club])),
    citiesById: new Map(cities.map((city) => [city.id, city])),
    stadiumsById: new Map(stadiums.map((stadium) => [stadium.id, stadium])),
    lastUpdated: latestTableDate(matches),
  };
}

/**
 * Single reactive store. Matches/clubs/cities/stadiums are bundled once and
 * extended in memory by the spreadsheet importer. Competitions are the one
 * collection with durable storage (IndexedDB, via CompetitionRepository) —
 * registering, editing or removing one never touches a project file.
 */
class DataStoreController implements DataStore {
  private snapshot: Snapshot;
  private readonly listeners = new Set<() => void>();
  private readonly competitionRepo = new CompetitionRepository();

  constructor() {
    this.snapshot = buildSnapshot(
      [],
      clubRows as unknown as Club[],
      cityRows as unknown as City[],
      stadiumRows as unknown as Stadium[],
      matchRows as unknown as Match[],
    );

    void this.competitionRepo.seedIfEmpty().then((competitions) => {
      this.replaceCompetitions(competitions);
    });
  }

  get competitions() {
    return this.snapshot.competitions;
  }
  get clubs() {
    return this.snapshot.clubs;
  }
  get cities() {
    return this.snapshot.cities;
  }
  get stadiums() {
    return this.snapshot.stadiums;
  }
  get matches() {
    return this.snapshot.matches;
  }
  get clubsById() {
    return this.snapshot.clubsById;
  }
  get citiesById() {
    return this.snapshot.citiesById;
  }
  get stadiumsById() {
    return this.snapshot.stadiumsById;
  }
  get lastUpdated() {
    return this.snapshot.lastUpdated;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): DataStore => this.snapshot;

  private replaceCompetitions(competitions: CompetitionRecord[]): void {
    this.snapshot = buildSnapshot(
      competitions,
      this.snapshot.clubs,
      this.snapshot.cities,
      this.snapshot.stadiums,
      this.snapshot.matches,
    );
    this.listeners.forEach((listener) => listener());
  }

  // ─── Competition management (backs the Competições screen) ───────────────

  async createCompetition(record: CompetitionRecord): Promise<void> {
    await this.competitionRepo.upsert(record);
    this.replaceCompetitions([...this.snapshot.competitions, record]);
  }

  async updateCompetition(id: string, patch: Partial<CompetitionRecord>): Promise<void> {
    const current = this.snapshot.competitions.find((item) => item.id === id);
    if (!current) throw new Error(`Competição "${id}" não encontrada.`);
    const updated = { ...current, ...patch, id };
    await this.competitionRepo.upsert(updated);
    this.replaceCompetitions(this.snapshot.competitions.map((item) => (item.id === id ? updated : item)));
  }

  async duplicateCompetition(id: string, overrides: Partial<CompetitionRecord> & { id: string }): Promise<void> {
    const source = this.snapshot.competitions.find((item) => item.id === id);
    if (!source) throw new Error(`Competição "${id}" não encontrada.`);
    const copy: CompetitionRecord = { ...source, ...overrides };
    await this.competitionRepo.upsert(copy);
    this.replaceCompetitions([...this.snapshot.competitions, copy]);
  }

  async archiveCompetition(id: string): Promise<void> {
    await this.updateCompetition(id, { active: false });
  }

  async deleteCompetition(id: string): Promise<void> {
    await this.competitionRepo.remove(id);
    this.replaceCompetitions(this.snapshot.competitions.filter((item) => item.id !== id));
  }

  /**
   * Merges spreadsheet rows into the store under an already-known
   * competition id — the id chosen in step 1 of the registration wizard, or
   * confirmed as already registered. Existing clubs/cities/stadiums are
   * reused; matches for that competition are replaced wholesale (re-running
   * an import corrects the table rather than appending to it).
   */
  importMatchesForCompetition(competitionId: string, rows: readonly ExtractedRow[]): { count: number } {
    return this.mergeMatches(competitionId, rows);
  }

  /**
   * Merge one imported spreadsheet into the store, reusing the exact same
   * normalization as the build-time importer. When the named competition
   * isn't already registered, a minimal record is created (and persisted) so
   * the quick "Importar CSV/XLSX" shortcut keeps working without forcing a
   * trip through the full registration wizard.
   */
  ingest(competitionName: string, rows: readonly ExtractedRow[]): { competitionId: string; count: number } {
    const competitionId = slug(competitionName).toUpperCase();

    if (!this.snapshot.competitions.some((item) => item.id === competitionId)) {
      const record: CompetitionRecord = {
        id: competitionId,
        name: competitionName,
        season: new Date().getFullYear(),
        category: "",
        gender: "",
        ageGroup: "",
        logo: "",
        background: emptyBackground(),
        templates: ["jogos-do-dia", "thumb-faftv"],
        active: true,
      };
      this.snapshot = buildSnapshot(
        [...this.snapshot.competitions, record],
        this.snapshot.clubs,
        this.snapshot.cities,
        this.snapshot.stadiums,
        this.snapshot.matches,
      );
      void this.competitionRepo.upsert(record);
    }

    const { count } = this.mergeMatches(competitionId, rows);
    return { competitionId, count };
  }

  private mergeMatches(competitionId: string, rows: readonly ExtractedRow[]): { count: number } {
    const clubs = [...this.snapshot.clubs];
    const cities = [...this.snapshot.cities];
    const stadiums = [...this.snapshot.stadiums];

    const upsertClub = (name: string): string => {
      const id = slug(name);
      if (!clubs.some((club) => club.id === id)) {
        clubs.push({ id, shortName: name, fullName: name, shield: "" });
      }
      return id;
    };

    const importedMatches: Match[] = [];
    for (const row of rows) {
      if (!row.home || !row.away) continue;

      const homeClubId = upsertClub(row.home);
      const awayClubId = upsertClub(row.away);

      const cityName = row.city ?? "";
      const cityId = cityName ? slug(cityName) : "";
      if (cityName && !cities.some((city) => city.id === cityId)) {
        cities.push({ id: cityId, name: cityName });
      }

      const stadiumName = row.stadium ?? "";
      const stadiumId = stadiumName ? slug(stadiumName) : "";
      if (stadiumName && !stadiums.some((stadium) => stadium.id === stadiumId)) {
        stadiums.push({ id: stadiumId, name: stadiumName, cityId });
      }

      importedMatches.push({
        competitionId,
        round: row.round ?? "",
        date: row.date ?? "",
        time: row.time ?? "",
        homeClubId,
        awayClubId,
        stadiumId,
        cityId,
        homeGoals: row.homeGoals,
        awayGoals: row.awayGoals,
        tv: row.tv,
      });
    }

    const matches = [
      ...this.snapshot.matches.filter((match) => match.competitionId !== competitionId),
      ...importedMatches,
    ];

    this.snapshot = buildSnapshot(this.snapshot.competitions, clubs, cities, stadiums, matches);
    this.listeners.forEach((listener) => listener());

    return { count: importedMatches.length };
  }
}

// The table modules are bundled once. This reactive store is the sole in-memory cache.
export const dataStore = new DataStoreController();
