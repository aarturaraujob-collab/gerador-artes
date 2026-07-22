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
import { ClubRepository, type Club } from "./clubRepository";
import { StadiumRepository, type Stadium } from "./stadiumRepository";
import { logActivity } from "./activityLog";

export type { BackgroundAssets, CompetitionRecord };
export type { Club } from "./clubRepository";
export type { Stadium } from "./stadiumRepository";
/** Alias kept for callers that only need the competition shape, not the repository. */
export type Competition = CompetitionRecord;

export interface City {
  id: string;
  name: string;
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
  /** Competition phase (e.g. "Fase de Grupos", "Mata-mata") — optional, informational, from the FASE column. */
  phase?: string | null;
  /** External match reference from the REF column — optional, informational only, not used as a dedup key. */
  ref?: string | null;
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
  phase?: string | null;
  ref?: string | null;
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
  private readonly clubRepo = new ClubRepository();
  private readonly stadiumRepo = new StadiumRepository();

  constructor() {
    // Clubs/stadiums render synchronously from the bundled seed on first
    // paint (engine template rendering depends on clubsById/stadiumsById
    // being populated immediately) — the IndexedDB-backed version (which
    // may include user edits from the Clubes/Estádios screens) then swaps
    // in once it resolves, same pattern as competitions below.
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
    void this.clubRepo.seedIfEmpty(clubRows as unknown as Club[]).then((clubs) => {
      this.replaceClubs(clubs);
    });
    void this.stadiumRepo.seedIfEmpty(stadiumRows as unknown as Stadium[]).then((stadiums) => {
      this.replaceStadiums(stadiums);
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

  // Trashed (soft-deleted) records are kept in IndexedDB but never shown
  // through the reactive snapshot — only the Lixeira screen reads them,
  // directly from the repositories (see listTrashed*/restore*/purge* below).

  private replaceCompetitions(competitions: CompetitionRecord[]): void {
    this.snapshot = buildSnapshot(
      competitions.filter((item) => !item.deletedAt),
      this.snapshot.clubs,
      this.snapshot.cities,
      this.snapshot.stadiums,
      this.snapshot.matches,
    );
    this.listeners.forEach((listener) => listener());
  }

  private replaceClubs(clubs: Club[]): void {
    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      clubs.filter((item) => !item.deletedAt),
      this.snapshot.cities,
      this.snapshot.stadiums,
      this.snapshot.matches,
    );
    this.listeners.forEach((listener) => listener());
  }

  private replaceStadiums(stadiums: Stadium[]): void {
    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      this.snapshot.clubs,
      this.snapshot.cities,
      stadiums.filter((item) => !item.deletedAt),
      this.snapshot.matches,
    );
    this.listeners.forEach((listener) => listener());
  }

  // ─── Club management (backs the Clubes screen) ────────────────────────────

  async createClub(record: Club): Promise<void> {
    await this.clubRepo.upsert(record);
    this.replaceClubs([...this.snapshot.clubs, record]);
    logActivity("club.created", `Clube "${record.fullName}" cadastrado.`);
  }

  async updateClub(id: string, patch: Partial<Club>): Promise<void> {
    const current = this.snapshot.clubs.find((item) => item.id === id);
    if (!current) throw new Error(`Clube "${id}" não encontrado.`);
    const updated = { ...current, ...patch, id };
    await this.clubRepo.upsert(updated);
    this.replaceClubs(this.snapshot.clubs.map((item) => (item.id === id ? updated : item)));
    logActivity("club.updated", `Clube "${updated.fullName}" atualizado.`);
  }

  /** Moves the club to the trash — it stays in IndexedDB until restored or purged. */
  async deleteClub(id: string): Promise<void> {
    const current = this.snapshot.clubs.find((item) => item.id === id);
    if (!current) throw new Error(`Clube "${id}" não encontrado.`);
    await this.clubRepo.upsert({ ...current, deletedAt: Date.now() });
    this.replaceClubs(this.snapshot.clubs.filter((item) => item.id !== id));
    logActivity("club.deleted", `Clube "${current.fullName}" movido para a lixeira.`);
  }

  async restoreClub(id: string): Promise<void> {
    const all = await this.clubRepo.list();
    const record = all.find((item) => item.id === id);
    if (!record) throw new Error(`Clube "${id}" não encontrado na lixeira.`);
    const restored = { ...record, deletedAt: null };
    await this.clubRepo.upsert(restored);
    this.replaceClubs([...this.snapshot.clubs, restored]);
    logActivity("club.restored", `Clube "${restored.fullName}" restaurado da lixeira.`);
  }

  async listTrashedClubs(): Promise<Club[]> {
    const all = await this.clubRepo.list();
    return all.filter((item) => item.deletedAt);
  }

  /** Permanent delete — only reachable from the Lixeira screen. */
  async purgeClub(id: string): Promise<void> {
    await this.clubRepo.remove(id);
  }

  // ─── Stadium management (backs the Estádios screen) ───────────────────────

  async createStadium(record: Stadium): Promise<void> {
    await this.stadiumRepo.upsert(record);
    this.replaceStadiums([...this.snapshot.stadiums, record]);
    logActivity("stadium.created", `Estádio "${record.name}" cadastrado.`);
  }

  async updateStadium(id: string, patch: Partial<Stadium>): Promise<void> {
    const current = this.snapshot.stadiums.find((item) => item.id === id);
    if (!current) throw new Error(`Estádio "${id}" não encontrado.`);
    const updated = { ...current, ...patch, id };
    await this.stadiumRepo.upsert(updated);
    this.replaceStadiums(this.snapshot.stadiums.map((item) => (item.id === id ? updated : item)));
    logActivity("stadium.updated", `Estádio "${updated.name}" atualizado.`);
  }

  /** Moves the stadium to the trash — it stays in IndexedDB until restored or purged. */
  async deleteStadium(id: string): Promise<void> {
    const current = this.snapshot.stadiums.find((item) => item.id === id);
    if (!current) throw new Error(`Estádio "${id}" não encontrado.`);
    await this.stadiumRepo.upsert({ ...current, deletedAt: Date.now() });
    this.replaceStadiums(this.snapshot.stadiums.filter((item) => item.id !== id));
    logActivity("stadium.deleted", `Estádio "${current.name}" movido para a lixeira.`);
  }

  async restoreStadium(id: string): Promise<void> {
    const all = await this.stadiumRepo.list();
    const record = all.find((item) => item.id === id);
    if (!record) throw new Error(`Estádio "${id}" não encontrado na lixeira.`);
    const restored = { ...record, deletedAt: null };
    await this.stadiumRepo.upsert(restored);
    this.replaceStadiums([...this.snapshot.stadiums, restored]);
    logActivity("stadium.restored", `Estádio "${restored.name}" restaurado da lixeira.`);
  }

  async listTrashedStadiums(): Promise<Stadium[]> {
    const all = await this.stadiumRepo.list();
    return all.filter((item) => item.deletedAt);
  }

  /** Permanent delete — only reachable from the Lixeira screen. */
  async purgeStadium(id: string): Promise<void> {
    await this.stadiumRepo.remove(id);
  }

  // ─── Competition management (backs the Competições screen) ───────────────

  async createCompetition(record: CompetitionRecord): Promise<void> {
    await this.competitionRepo.upsert(record);
    this.replaceCompetitions([...this.snapshot.competitions, record]);
    logActivity("competition.created", `Competição "${record.name}" cadastrada.`);
  }

  async updateCompetition(id: string, patch: Partial<CompetitionRecord>): Promise<void> {
    const current = this.snapshot.competitions.find((item) => item.id === id);
    if (!current) throw new Error(`Competição "${id}" não encontrada.`);
    const updated = { ...current, ...patch, id };
    await this.competitionRepo.upsert(updated);
    this.replaceCompetitions(this.snapshot.competitions.map((item) => (item.id === id ? updated : item)));
    logActivity("competition.updated", `Competição "${updated.name}" atualizada.`);
  }

  async duplicateCompetition(id: string, overrides: Partial<CompetitionRecord> & { id: string }): Promise<void> {
    const source = this.snapshot.competitions.find((item) => item.id === id);
    if (!source) throw new Error(`Competição "${id}" não encontrada.`);
    const copy: CompetitionRecord = { ...source, ...overrides };
    await this.competitionRepo.upsert(copy);
    this.replaceCompetitions([...this.snapshot.competitions, copy]);
    logActivity("competition.created", `Competição "${copy.name}" duplicada de "${source.name}".`);
  }

  async archiveCompetition(id: string): Promise<void> {
    await this.updateCompetition(id, { active: false });
  }

  /** Moves the competition to the trash — it stays in IndexedDB until restored or purged. */
  async deleteCompetition(id: string): Promise<void> {
    const current = this.snapshot.competitions.find((item) => item.id === id);
    if (!current) throw new Error(`Competição "${id}" não encontrada.`);
    await this.competitionRepo.upsert({ ...current, deletedAt: Date.now() });
    this.replaceCompetitions(this.snapshot.competitions.filter((item) => item.id !== id));
    logActivity("competition.deleted", `Competição "${current.name}" movida para a lixeira.`);
  }

  async restoreCompetition(id: string): Promise<void> {
    const all = await this.competitionRepo.list();
    const record = all.find((item) => item.id === id);
    if (!record) throw new Error(`Competição "${id}" não encontrada na lixeira.`);
    const restored = { ...record, deletedAt: null };
    await this.competitionRepo.upsert(restored);
    this.replaceCompetitions([...this.snapshot.competitions, restored]);
    logActivity("competition.restored", `Competição "${restored.name}" restaurada da lixeira.`);
  }

  async listTrashedCompetitions(): Promise<CompetitionRecord[]> {
    const all = await this.competitionRepo.list();
    return all.filter((item) => item.deletedAt);
  }

  /** Permanent delete — only reachable from the Lixeira screen. */
  async purgeCompetition(id: string): Promise<void> {
    await this.competitionRepo.remove(id);
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
        const club: Club = { id, shortName: name, fullName: name, shield: "" };
        clubs.push(club);
        void this.clubRepo.upsert(club);
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
        const stadium: Stadium = { id: stadiumId, name: stadiumName, cityId };
        stadiums.push(stadium);
        void this.stadiumRepo.upsert(stadium);
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
        phase: row.phase ?? null,
        ref: row.ref ?? null,
      });
    }

    const matches = [
      ...this.snapshot.matches.filter((match) => match.competitionId !== competitionId),
      ...importedMatches,
    ];

    this.snapshot = buildSnapshot(this.snapshot.competitions, clubs, cities, stadiums, matches);
    this.listeners.forEach((listener) => listener());

    const competitionName = this.snapshot.competitions.find((item) => item.id === competitionId)?.name ?? competitionId;
    logActivity("import.matches", `${importedMatches.length} jogo(s) importado(s) para "${competitionName}".`);

    return { count: importedMatches.length };
  }
}

// The table modules are bundled once. This reactive store is the sole in-memory cache.
export const dataStore = new DataStoreController();
