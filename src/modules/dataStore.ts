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
import { CityRepository, type City } from "./cityRepository";
import { MatchRepository } from "./matchRepository";
import { logActivity } from "./activityLog";
import { OperationalStaffRepository, type OperationalStaff } from "./operationalStaffRepository";
import { MatchFaftvRepository, type MatchFaftvRecord } from "./matchFaftvRepository";
import { MatchOperacaoRepository, type MatchOperacaoRecord } from "./matchOperacaoRepository";
import {
  MatchOperationsHistoryRepository,
  type MatchHistoryEntry,
  type MatchOperationsModule,
} from "./matchOperationsHistoryRepository";
import {
  FAFTV_CHECKLIST_ITEMS,
  OPERACAO_CHECKLIST_ITEMS,
  computeFaftvStatus,
  computeOperacaoStatus,
  type FaftvStatus,
  type OperacaoStatus,
} from "./matchOperationsChecklists";
import { getOperatorName } from "./operatorName";

export type { BackgroundAssets, CompetitionRecord };
export type { Club } from "./clubRepository";
export type { Stadium } from "./stadiumRepository";
export type { City } from "./cityRepository";
export type { OperationalStaff, StaffArea } from "./operationalStaffRepository";
export type { MatchFaftvRecord } from "./matchFaftvRepository";
export type { MatchOperacaoRecord } from "./matchOperacaoRepository";
export type { MatchHistoryEntry } from "./matchOperationsHistoryRepository";
/** Alias kept for callers that only need the competition shape, not the repository. */
export type Competition = CompetitionRecord;

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

/** All operational data (FAFTV + Operação + Histórico) tracked for one match, keyed by its gameRef. */
export interface MatchOperationsEntry {
  faftv: MatchFaftvRecord;
  operacao: MatchOperacaoRecord;
  history: MatchHistoryEntry[];
}

/** Immutable read model shared by the UI and the engine. */
export interface DataStore {
  competitions: readonly Competition[];
  clubs: readonly Club[];
  cities: readonly City[];
  stadiums: readonly Stadium[];
  matches: readonly Match[];
  staff: readonly OperationalStaff[];
  clubsById: ReadonlyMap<string, Club>;
  citiesById: ReadonlyMap<string, City>;
  stadiumsById: ReadonlyMap<string, Stadium>;
  staffById: ReadonlyMap<string, OperationalStaff>;
  matchOps: ReadonlyMap<string, MatchOperationsEntry>;
  lastUpdated: string;
}

interface Snapshot {
  competitions: Competition[];
  clubs: Club[];
  cities: City[];
  stadiums: Stadium[];
  matches: Match[];
  staff: OperationalStaff[];
  clubsById: Map<string, Club>;
  citiesById: Map<string, City>;
  stadiumsById: Map<string, Stadium>;
  staffById: Map<string, OperationalStaff>;
  matchOps: ReadonlyMap<string, MatchOperationsEntry>;
  lastUpdated: string;
}

function faftvStatusLabel(status: FaftvStatus): string {
  switch (status) {
    case "planejamento":
      return "Planejamento";
    case "em_preparacao":
      return "Em preparação";
    case "pronto":
      return "Pronto";
  }
}

function operacaoStatusLabel(status: OperacaoStatus): string {
  return status === "pronto" ? "Pronto" : "Em preparação";
}

export function slug(value: string): string {
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
  staff: OperationalStaff[],
  matchOps: ReadonlyMap<string, MatchOperationsEntry>,
): Snapshot {
  return {
    competitions,
    clubs,
    cities,
    stadiums,
    matches,
    staff,
    clubsById: new Map(clubs.map((club) => [club.id, club])),
    citiesById: new Map(cities.map((city) => [city.id, city])),
    stadiumsById: new Map(stadiums.map((stadium) => [stadium.id, stadium])),
    staffById: new Map(staff.map((person) => [person.id, person])),
    matchOps,
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
  private readonly cityRepo = new CityRepository();
  private readonly matchRepo = new MatchRepository();
  private readonly staffRepo = new OperationalStaffRepository();
  private readonly faftvRepo = new MatchFaftvRepository();
  private readonly operacaoRepo = new MatchOperacaoRepository();
  private readonly historyRepo = new MatchOperationsHistoryRepository();

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
      [],
      new Map(),
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
    void this.cityRepo.seedIfEmpty(cityRows as unknown as City[]).then((cities) => {
      this.replaceCities(cities);
    });
    void this.matchRepo.seedIfEmpty(matchRows as unknown as Match[]).then((matches) => {
      this.replaceMatches(matches);
    });
    void this.staffRepo.list().then((staff) => {
      this.replaceStaff(staff);
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
  get staff() {
    return this.snapshot.staff;
  }
  get staffById() {
    return this.snapshot.staffById;
  }
  get matchOps() {
    return this.snapshot.matchOps;
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
      this.snapshot.staff,
      this.snapshot.matchOps,
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
      this.snapshot.staff,
      this.snapshot.matchOps,
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
      this.snapshot.staff,
      this.snapshot.matchOps,
    );
    this.listeners.forEach((listener) => listener());
  }

  private replaceCities(cities: City[]): void {
    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      this.snapshot.clubs,
      cities.filter((item) => !item.deletedAt),
      this.snapshot.stadiums,
      this.snapshot.matches,
      this.snapshot.staff,
      this.snapshot.matchOps,
    );
    this.listeners.forEach((listener) => listener());
  }

  private replaceMatches(matches: Match[]): void {
    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      this.snapshot.clubs,
      this.snapshot.cities,
      this.snapshot.stadiums,
      matches,
      this.snapshot.staff,
      this.snapshot.matchOps,
    );
    this.listeners.forEach((listener) => listener());
  }

  private replaceStaff(staff: OperationalStaff[]): void {
    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      this.snapshot.clubs,
      this.snapshot.cities,
      this.snapshot.stadiums,
      this.snapshot.matches,
      staff.filter((item) => !item.deletedAt),
      this.snapshot.matchOps,
    );
    this.listeners.forEach((listener) => listener());
  }

  private replaceMatchOps(matchOps: ReadonlyMap<string, MatchOperationsEntry>): void {
    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      this.snapshot.clubs,
      this.snapshot.cities,
      this.snapshot.stadiums,
      this.snapshot.matches,
      this.snapshot.staff,
      matchOps,
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

  // ─── City management (backs the Cidades screen) ───────────────────────────

  async createCity(record: City): Promise<void> {
    await this.cityRepo.upsert(record);
    this.replaceCities([...this.snapshot.cities, record]);
    logActivity("city.created", `Cidade "${record.name}" cadastrada.`);
  }

  async updateCity(id: string, patch: Partial<City>): Promise<void> {
    const current = this.snapshot.cities.find((item) => item.id === id);
    if (!current) throw new Error(`Cidade "${id}" não encontrada.`);
    const updated = { ...current, ...patch, id };
    await this.cityRepo.upsert(updated);
    this.replaceCities(this.snapshot.cities.map((item) => (item.id === id ? updated : item)));
    logActivity("city.updated", `Cidade "${updated.name}" atualizada.`);
  }

  /** Moves the city to the trash — it stays in IndexedDB until restored or purged. */
  async deleteCity(id: string): Promise<void> {
    const current = this.snapshot.cities.find((item) => item.id === id);
    if (!current) throw new Error(`Cidade "${id}" não encontrada.`);
    await this.cityRepo.upsert({ ...current, deletedAt: Date.now() });
    this.replaceCities(this.snapshot.cities.filter((item) => item.id !== id));
    logActivity("city.deleted", `Cidade "${current.name}" movida para a lixeira.`);
  }

  async restoreCity(id: string): Promise<void> {
    const all = await this.cityRepo.list();
    const record = all.find((item) => item.id === id);
    if (!record) throw new Error(`Cidade "${id}" não encontrada na lixeira.`);
    const restored = { ...record, deletedAt: null };
    await this.cityRepo.upsert(restored);
    this.replaceCities([...this.snapshot.cities, restored]);
    logActivity("city.restored", `Cidade "${restored.name}" restaurada da lixeira.`);
  }

  async listTrashedCities(): Promise<City[]> {
    const all = await this.cityRepo.list();
    return all.filter((item) => item.deletedAt);
  }

  /** Permanent delete — only reachable from the Lixeira screen. */
  async purgeCity(id: string): Promise<void> {
    await this.cityRepo.remove(id);
  }

  // ─── Operational staff management (backs the FAFTV/Oficiais DCO screens) ──

  async createStaff(record: OperationalStaff): Promise<void> {
    await this.staffRepo.upsert(record);
    this.replaceStaff([...this.snapshot.staff, record]);
    logActivity("staff.created", `${record.area === "FAFTV" ? "FAFTV" : "Oficial DCO"} "${record.name}" cadastrado.`);
  }

  async updateStaff(id: string, patch: Partial<OperationalStaff>): Promise<void> {
    const current = this.snapshot.staff.find((item) => item.id === id);
    if (!current) throw new Error(`Pessoa "${id}" não encontrada.`);
    const updated = { ...current, ...patch, id };
    await this.staffRepo.upsert(updated);
    this.replaceStaff(this.snapshot.staff.map((item) => (item.id === id ? updated : item)));
    logActivity("staff.updated", `${updated.area === "FAFTV" ? "FAFTV" : "Oficial DCO"} "${updated.name}" atualizado.`);
  }

  /** Moves the person to the trash — they stay in IndexedDB until restored or purged. */
  async deleteStaff(id: string): Promise<void> {
    const current = this.snapshot.staff.find((item) => item.id === id);
    if (!current) throw new Error(`Pessoa "${id}" não encontrada.`);
    await this.staffRepo.upsert({ ...current, deletedAt: Date.now() });
    this.replaceStaff(this.snapshot.staff.filter((item) => item.id !== id));
    logActivity("staff.deleted", `"${current.name}" movido para a lixeira.`);
  }

  async restoreStaff(id: string): Promise<void> {
    const all = await this.staffRepo.list();
    const record = all.find((item) => item.id === id);
    if (!record) throw new Error(`Pessoa "${id}" não encontrada na lixeira.`);
    const restored = { ...record, deletedAt: null };
    await this.staffRepo.upsert(restored);
    this.replaceStaff([...this.snapshot.staff, restored]);
    logActivity("staff.restored", `"${restored.name}" restaurado da lixeira.`);
  }

  async listTrashedStaff(): Promise<OperationalStaff[]> {
    const all = await this.staffRepo.list();
    return all.filter((item) => item.deletedAt);
  }

  /** Permanent delete — only reachable from the Lixeira screen. */
  async purgeStaff(id: string): Promise<void> {
    await this.staffRepo.remove(id);
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
        this.snapshot.staff,
        this.snapshot.matchOps,
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
        const city: City = { id: cityId, name: cityName };
        cities.push(city);
        void this.cityRepo.upsert(city);
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
    void this.matchRepo.replaceForCompetition(competitionId, importedMatches);

    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      clubs,
      cities,
      stadiums,
      matches,
      this.snapshot.staff,
      this.snapshot.matchOps,
    );
    this.listeners.forEach((listener) => listener());

    const competitionName = this.snapshot.competitions.find((item) => item.id === competitionId)?.name ?? competitionId;
    logActivity("import.matches", `${importedMatches.length} jogo(s) importado(s) para "${competitionName}".`);

    return { count: importedMatches.length };
  }

  // ─── Match-scoped FAFTV/Operação (backs the match page's "Central Operacional") ───
  // Distinct from logActivity()/activityLog.ts above — this is a separate,
  // uncapped, per-match trail (CP6), not the global 50-entry cadastro log.

  private async recordHistory(
    gameRef: string,
    module: MatchOperationsModule,
    description: string,
    priorHistory: MatchHistoryEntry[],
  ): Promise<MatchHistoryEntry[]> {
    const entry: MatchHistoryEntry = {
      id: crypto.randomUUID(),
      gameRef,
      module,
      operator: getOperatorName() || "Usuário",
      description,
      timestamp: Date.now(),
    };
    await this.historyRepo.append(entry);
    return [entry, ...priorHistory];
  }

  /** Get-or-create: loads (or initializes) this match's FAFTV/Operação/Histórico into the reactive snapshot. */
  async ensureMatchOperationsLoaded(gameRef: string): Promise<void> {
    if (this.snapshot.matchOps.has(gameRef)) return;

    const [faftv, operacao, history] = await Promise.all([
      this.faftvRepo.get(gameRef),
      this.operacaoRepo.get(gameRef),
      this.historyRepo.listByGameRef(gameRef),
    ]);

    const resolvedFaftv: MatchFaftvRecord = faftv ?? {
      id: gameRef,
      gameRef,
      coordinatorStaffId: null,
      commentatorStaffId: null,
      broadcastLink: "",
      checklist: {},
      status: "planejamento",
      updatedAt: Date.now(),
    };
    const resolvedOperacao: MatchOperacaoRecord = operacao ?? {
      id: gameRef,
      gameRef,
      delegadoStaffId: null,
      supervisorStaffId: null,
      fiscalStaffId: null,
      controleAcessoStaffId: null,
      checklist: {},
      status: "em_preparacao",
      updatedAt: Date.now(),
    };

    const matchOps = new Map(this.snapshot.matchOps);
    matchOps.set(gameRef, { faftv: resolvedFaftv, operacao: resolvedOperacao, history });
    this.replaceMatchOps(matchOps);
  }

  private requireMatchOps(gameRef: string): MatchOperationsEntry {
    const entry = this.snapshot.matchOps.get(gameRef);
    if (!entry) throw new Error(`Operações da partida não carregadas — chame ensureMatchOperationsLoaded primeiro.`);
    return entry;
  }

  async updateFaftvTeam(
    gameRef: string,
    patch: { coordinatorStaffId?: string | null; commentatorStaffId?: string | null },
  ): Promise<void> {
    const entry = this.requireMatchOps(gameRef);
    const updated: MatchFaftvRecord = { ...entry.faftv, ...patch, updatedAt: Date.now() };
    updated.status = computeFaftvStatus(updated);
    await this.faftvRepo.upsert(updated);

    let history = entry.history;
    if (patch.coordinatorStaffId !== undefined) {
      const name = patch.coordinatorStaffId
        ? (this.snapshot.staffById.get(patch.coordinatorStaffId)?.name ?? patch.coordinatorStaffId)
        : "não definido";
      history = await this.recordHistory(gameRef, "faftv", `Coordenador FAFTV: ${name}`, history);
    }
    if (patch.commentatorStaffId !== undefined) {
      const name = patch.commentatorStaffId
        ? (this.snapshot.staffById.get(patch.commentatorStaffId)?.name ?? patch.commentatorStaffId)
        : "não definido";
      history = await this.recordHistory(gameRef, "faftv", `Comentarista FAFTV: ${name}`, history);
    }
    if (updated.status !== entry.faftv.status) {
      history = await this.recordHistory(gameRef, "faftv", `Status FAFTV alterado para "${faftvStatusLabel(updated.status)}"`, history);
    }

    const matchOps = new Map(this.snapshot.matchOps);
    matchOps.set(gameRef, { ...entry, faftv: updated, history });
    this.replaceMatchOps(matchOps);
  }

  async updateFaftvLink(gameRef: string, link: string): Promise<void> {
    const entry = this.requireMatchOps(gameRef);
    const updated: MatchFaftvRecord = { ...entry.faftv, broadcastLink: link, updatedAt: Date.now() };
    updated.status = computeFaftvStatus(updated);
    await this.faftvRepo.upsert(updated);

    let history = await this.recordHistory(gameRef, "faftv", "Link de transmissão atualizado", entry.history);
    if (updated.status !== entry.faftv.status) {
      history = await this.recordHistory(gameRef, "faftv", `Status FAFTV alterado para "${faftvStatusLabel(updated.status)}"`, history);
    }

    const matchOps = new Map(this.snapshot.matchOps);
    matchOps.set(gameRef, { ...entry, faftv: updated, history });
    this.replaceMatchOps(matchOps);
  }

  async toggleFaftvChecklistItem(gameRef: string, itemId: string): Promise<void> {
    const entry = this.requireMatchOps(gameRef);
    const checked = !entry.faftv.checklist[itemId];
    const updated: MatchFaftvRecord = {
      ...entry.faftv,
      checklist: { ...entry.faftv.checklist, [itemId]: checked },
      updatedAt: Date.now(),
    };
    updated.status = computeFaftvStatus(updated);
    await this.faftvRepo.upsert(updated);

    const label = FAFTV_CHECKLIST_ITEMS.find((item) => item.id === itemId)?.label ?? itemId;
    let history = await this.recordHistory(gameRef, "faftv", `Item "${label}" ${checked ? "concluído" : "reaberto"}`, entry.history);
    if (updated.status !== entry.faftv.status) {
      history = await this.recordHistory(gameRef, "faftv", `Status FAFTV alterado para "${faftvStatusLabel(updated.status)}"`, history);
    }

    const matchOps = new Map(this.snapshot.matchOps);
    matchOps.set(gameRef, { ...entry, faftv: updated, history });
    this.replaceMatchOps(matchOps);
  }

  async updateOperacaoTeam(
    gameRef: string,
    patch: Partial<
      Pick<MatchOperacaoRecord, "delegadoStaffId" | "supervisorStaffId" | "fiscalStaffId" | "controleAcessoStaffId">
    >,
  ): Promise<void> {
    const entry = this.requireMatchOps(gameRef);
    const updated: MatchOperacaoRecord = { ...entry.operacao, ...patch, updatedAt: Date.now() };
    updated.status = computeOperacaoStatus(updated);
    await this.operacaoRepo.upsert(updated);

    const roleLabels: Record<string, string> = {
      delegadoStaffId: "Delegado",
      supervisorStaffId: "Supervisor",
      fiscalStaffId: "Fiscal",
      controleAcessoStaffId: "Controle de Acesso",
    };

    let history = entry.history;
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const name = value ? (this.snapshot.staffById.get(value)?.name ?? value) : "não definido";
      history = await this.recordHistory(gameRef, "operacao", `${roleLabels[key]}: ${name}`, history);
    }
    if (updated.status !== entry.operacao.status) {
      history = await this.recordHistory(
        gameRef,
        "operacao",
        `Status Operação alterado para "${operacaoStatusLabel(updated.status)}"`,
        history,
      );
    }

    const matchOps = new Map(this.snapshot.matchOps);
    matchOps.set(gameRef, { ...entry, operacao: updated, history });
    this.replaceMatchOps(matchOps);
  }

  async toggleOperacaoChecklistItem(gameRef: string, itemId: string): Promise<void> {
    const entry = this.requireMatchOps(gameRef);
    const checked = !entry.operacao.checklist[itemId];
    const updated: MatchOperacaoRecord = {
      ...entry.operacao,
      checklist: { ...entry.operacao.checklist, [itemId]: checked },
      updatedAt: Date.now(),
    };
    updated.status = computeOperacaoStatus(updated);
    await this.operacaoRepo.upsert(updated);

    const label = OPERACAO_CHECKLIST_ITEMS.find((item) => item.id === itemId)?.label ?? itemId;
    let history = await this.recordHistory(gameRef, "operacao", `Item "${label}" ${checked ? "concluído" : "reaberto"}`, entry.history);
    if (updated.status !== entry.operacao.status) {
      history = await this.recordHistory(
        gameRef,
        "operacao",
        `Status Operação alterado para "${operacaoStatusLabel(updated.status)}"`,
        history,
      );
    }

    const matchOps = new Map(this.snapshot.matchOps);
    matchOps.set(gameRef, { ...entry, operacao: updated, history });
    this.replaceMatchOps(matchOps);
  }
}

// The table modules are bundled once. This reactive store is the sole in-memory cache.
export const dataStore = new DataStoreController();
