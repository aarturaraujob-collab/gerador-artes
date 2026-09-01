import slugify from "slugify";

import { matches as matchRows } from "../../tables/matches";
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
import { buildGameRef } from "./gameRef";
import { clubDisplayName } from "./clubDisplay";
import { computeBracketResolutionPatches } from "./bracketResolution";
import { logActivity } from "./activityLog";
import { OperationalStaffRepository, type OperationalStaff } from "./operationalStaffRepository";
import { MatchFaftvRepository, type MatchFaftvRecord } from "./matchFaftvRepository";
import { MatchOperacaoRepository, type MatchOperacaoRecord } from "./matchOperacaoRepository";
import { MatchFaftvEscalaRepository } from "./matchFaftvEscalaRepository";
import { MatchArbitragemRepository } from "./matchArbitragemRepository";
import { matchBorderoRepository } from "./matchBorderoRepository";
import { matchFafOficialRepository } from "./matchFafOficialRepository";
import { competitionFafOficialRepository } from "./competitionFafOficialRepository";
import { imtRepository } from "../documents/repository/imtRepository";
import { detailedTableRepository } from "../documents/repository/detailedTableRepository";
import { playerStatsRepository } from "./playerStatsRepository";
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
  /** Which mata-mata confronto (CompetitionPhaseConfig.matchups[].id) this match settles — see bracketResolution.ts. Null for pontos-phase matches. */
  bracketSlot?: string | null;
  /** External match reference from the REF column — optional, informational only, not used as a dedup key. */
  ref?: string | null;
  /** Attendance for this match — optional, filled in manually or by a future import; null until then. */
  publico?: number | null;
  /** Gate revenue for this match (R$) — optional, same as `publico`. */
  renda?: number | null;
  /** Penalty shootout score — only set when a knockout-phase match (bracketSlot != null) ends in a draw. */
  penaltyHomeGoals?: number | null;
  penaltyAwayGoals?: number | null;
  /**
   * True when this match's score is a walkover (W.O.) — the team that showed
   * up wins 3x0 administratively, nobody actually played. Counts for
   * pontos/V-E-D and goalsFor/goalsAgainst (goal difference tiebreak in the
   * classificação table), but the 3 goals are excluded from ataque/defesa
   * rankings and from "gols em todas as competições" — see standings.ts and
   * FafLabDashboard.tsx's labHighlights.
   */
  wo?: boolean;
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
  penaltyHomeGoals?: number | null;
  penaltyAwayGoals?: number | null;
  wo?: boolean;
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
  /** True until the first Supabase fetch of clubs/estádios/cidades resolves. */
  loadingRegistry: boolean;
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
  loadingRegistry: boolean;
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
  loadingRegistry: boolean,
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
    loadingRegistry,
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
  private readonly faftvEscalaRepo = new MatchFaftvEscalaRepository();
  private readonly arbitragemRepo = new MatchArbitragemRepository();

  constructor() {
    // Every collection (Fases 1-6 da migração pro Supabase) starts empty and
    // populates once the initial fetch resolves — see `loadingRegistry`.
    this.snapshot = buildSnapshot([], [], [], [], [], [], new Map(), true);

    void Promise.all([
      this.competitionRepo.seedIfEmpty(),
      this.clubRepo.list(),
      this.stadiumRepo.list(),
      this.cityRepo.list(),
      this.matchRepo.seedIfEmpty(matchRows as unknown as Match[]),
      this.staffRepo.list(),
    ]).then(([competitions, clubs, stadiums, cities, matches, staff]: [
      CompetitionRecord[],
      Club[],
      Stadium[],
      City[],
      Match[],
      OperationalStaff[],
    ]) => {
      this.snapshot = buildSnapshot(
        competitions.filter((item) => !item.deletedAt),
        clubs.filter((item) => !item.deletedAt),
        cities.filter((item) => !item.deletedAt),
        stadiums.filter((item) => !item.deletedAt),
        matches,
        staff.filter((item) => !item.deletedAt),
        this.snapshot.matchOps,
        false,
      );
      this.listeners.forEach((listener) => listener());
    });
  }

  get loadingRegistry() {
    return this.snapshot.loadingRegistry;
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
      this.snapshot.loadingRegistry,
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
      this.snapshot.loadingRegistry,
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
      this.snapshot.loadingRegistry,
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
      this.snapshot.loadingRegistry,
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
      this.snapshot.loadingRegistry,
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
      this.snapshot.loadingRegistry,
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
      this.snapshot.loadingRegistry,
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

  /**
   * Permanent delete — only reachable from the Lixeira screen. None of a
   * competition's dependents (matches and their FAFTV/Operação/Arbitragem/
   * Escala/Histórico, IMTs, Tabela Detalhada versions, estatísticas de
   * jogadores) cascade on delete, so they're torn down explicitly first —
   * otherwise this throws an FK violation for any competition that ever had
   * matches or documents generated.
   */
  async purgeCompetition(id: string): Promise<void> {
    const competitionMatches = this.snapshot.matches.filter((match) => match.competitionId === id);
    for (const match of competitionMatches) {
      const gameRef = buildGameRef(match);
      await this.cleanupMatchOps(gameRef);
      await this.matchRepo.remove(gameRef);
    }

    const [imts, detailedTables] = await Promise.all([
      imtRepository.listByCompetition(id),
      detailedTableRepository.listByCompetition(id),
    ]);
    await Promise.all(imts.map((imt) => imtRepository.remove(imt.id)));
    await Promise.all(detailedTables.map((table) => detailedTableRepository.remove(table.id)));
    await playerStatsRepository.replaceForCompetition(id, []);
    await competitionFafOficialRepository.remove(id);

    await this.competitionRepo.remove(id);
  }

  /**
   * Merges spreadsheet rows into the store under an already-known
   * competition id — the id chosen in step 1 of the registration wizard, or
   * confirmed as already registered. Existing clubs/cities/stadiums are
   * reused; matches for that competition are replaced wholesale (re-running
   * an import corrects the table rather than appending to it).
   */
  async importMatchesForCompetition(competitionId: string, rows: readonly ExtractedRow[]): Promise<{ count: number }> {
    return this.mergeMatches(competitionId, rows);
  }

  /**
   * Merge one imported spreadsheet into the store, reusing the exact same
   * normalization as the build-time importer. When the named competition
   * isn't already registered, a minimal record is created (and persisted) so
   * the quick "Importar CSV/XLSX" shortcut keeps working without forcing a
   * trip through the full registration wizard.
   */
  async ingest(competitionName: string, rows: readonly ExtractedRow[]): Promise<{ competitionId: string; count: number }> {
    const competitionId = slug(competitionName).toUpperCase();
    const hasValidRow = rows.some((row) => row.home && row.away);

    if (hasValidRow && !this.snapshot.competitions.some((item) => item.id === competitionId)) {
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
      await this.competitionRepo.upsert(record);
      this.snapshot = buildSnapshot(
        [...this.snapshot.competitions, record],
        this.snapshot.clubs,
        this.snapshot.cities,
        this.snapshot.stadiums,
        this.snapshot.matches,
        this.snapshot.staff,
        this.snapshot.matchOps,
        this.snapshot.loadingRegistry,
      );
    }

    const { count } = await this.mergeMatches(competitionId, rows);
    return { competitionId, count };
  }

  /**
   * Persists cities → stadiums → matches in that order and awaits each step:
   * `matches.stadium_id`/`city_id` are foreign keys, so inserting a match
   * before its stadium/city row has actually committed fails with an FK
   * violation. Nothing here fires-and-forgets — a failed write throws instead
   * of silently leaving the local snapshot out of sync with the database.
   */
  private async mergeMatches(competitionId: string, rows: readonly ExtractedRow[]): Promise<{ count: number }> {
    const clubs = [...this.snapshot.clubs];
    const cities = [...this.snapshot.cities];
    const stadiums = [...this.snapshot.stadiums];

    const newClubs: Club[] = [];
    const newCities: City[] = [];
    const newStadiums: Stadium[] = [];

    const upsertClub = (name: string): string => {
      const id = slug(name);
      if (!clubs.some((club) => club.id === id)) {
        const club: Club = { id, shortName: name, fullName: name, shield: "" };
        clubs.push(club);
        newClubs.push(club);
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
        newCities.push(city);
      }

      const stadiumName = row.stadium ?? "";
      const stadiumId = stadiumName ? slug(stadiumName) : "";
      if (stadiumName && !stadiums.some((stadium) => stadium.id === stadiumId)) {
        const stadium: Stadium = { id: stadiumId, name: stadiumName, cityId };
        stadiums.push(stadium);
        newStadiums.push(stadium);
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
        penaltyHomeGoals: row.penaltyHomeGoals ?? null,
        penaltyAwayGoals: row.penaltyAwayGoals ?? null,
        wo: row.wo ?? false,
      });
    }

    await Promise.all(newClubs.map((club) => this.clubRepo.upsert(club)));
    await Promise.all(newCities.map((city) => this.cityRepo.upsert(city)));
    await Promise.all(newStadiums.map((stadium) => this.stadiumRepo.upsert(stadium)));

    // A fixture that disappears from this reimport (round/date/time/clubs no
    // longer match anything, so its old id isn't in the new set) still has
    // its FAFTV/Operação/Arbitragem/Escala/Histórico rows FK-referencing that
    // old id — clear those first, or replaceForCompetition's delete of the
    // now-gone match rows fails/crashes the whole reimport.
    // Diffs against the DB's current ids (not this.snapshot.matches) so this
    // always matches exactly what matchRepo.replaceForCompetition below is
    // about to delete — a stale in-memory snapshot (e.g. a match row that
    // exists in Postgres but was never fetched into this session) would
    // otherwise skip that row's cleanup here while still being deleted below,
    // leaving its FAFTV/Operação/Arbitragem/Escala/Borderô rows to violate
    // the FK the moment that DELETE runs.
    const keptIds = new Set(importedMatches.map((match) => buildGameRef(match)));
    const existingIds = await this.matchRepo.listIdsForCompetition(competitionId);
    const droppedIds = existingIds.filter((id) => !keptIds.has(id));
    for (const id of droppedIds) {
      await this.cleanupMatchOps(id);
    }

    await this.matchRepo.replaceForCompetition(competitionId, importedMatches);

    const matches = [
      ...this.snapshot.matches.filter((match) => match.competitionId !== competitionId),
      ...importedMatches,
    ];

    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      clubs,
      cities,
      stadiums,
      matches,
      this.snapshot.staff,
      this.snapshot.matchOps,
      this.snapshot.loadingRegistry,
    );
    this.listeners.forEach((listener) => listener());

    const competitionName = this.snapshot.competitions.find((item) => item.id === competitionId)?.name ?? competitionId;
    logActivity("import.matches", `${importedMatches.length} jogo(s) importado(s) para "${competitionName}".`);

    return { count: importedMatches.length };
  }

  // ─── Single-match edits (backs "Editar placar" and the IMT reschedule) ───
  // Classificação/Estatísticas/Tabela Detalhada all derive live from
  // store.matches (calculateStandings et al.), so persisting the edit here is
  // the only step needed for them to reflect it — no separate "recalculate"
  // step exists or is needed.

  /**
   * Updates one match in place (score, or — from GenerateIMTDialog — a
   * reschedule). `gameRef` is derived from round/date/time/clubs, so a
   * reschedule changes it; any FAFTV/Operação/Histórico already tied to the
   * match is migrated to the new gameRef so rescheduling never silently
   * drops operational planning already done for that match.
   */
  async updateMatch(gameRef: string, patch: Partial<Match>): Promise<void> {
    const match = this.snapshot.matches.find((item) => buildGameRef(item) === gameRef);
    await this.applyMatchUpdate(gameRef, patch);
    if (match) await this.runBracketResolution(match.competitionId);
  }

  /** Creates a brand-new match row — backs the "Criar Partida" dialog. Triggers the same bracket resolution pass as a score edit. */
  async createMatch(match: Match): Promise<void> {
    await this.matchRepo.update(match, match);
    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      this.snapshot.clubs,
      this.snapshot.cities,
      this.snapshot.stadiums,
      [...this.snapshot.matches, match],
      this.snapshot.staff,
      this.snapshot.matchOps,
      this.snapshot.loadingRegistry,
    );
    this.listeners.forEach((listener) => listener());
    await this.runBracketResolution(match.competitionId);

    const home = clubDisplayName(match.homeClubId, this.snapshot.clubsById);
    const away = clubDisplayName(match.awayClubId, this.snapshot.clubsById);
    logActivity("match.created", `${home} × ${away} criado(a).`);
  }

  /** Permanently deletes one match — clears its FAFTV/Operação/Arbitragem/Escala/Histórico rows first (none of those cascade on delete), same as purgeCompetition does per-match. */
  async deleteMatch(gameRef: string): Promise<void> {
    const match = this.snapshot.matches.find((item) => buildGameRef(item) === gameRef);
    if (!match) throw new Error("Partida não encontrada.");

    await this.cleanupMatchOps(gameRef);
    await this.matchRepo.remove(gameRef);

    const matches = this.snapshot.matches.filter((item) => buildGameRef(item) !== gameRef);
    const matchOps = new Map(this.snapshot.matchOps);
    matchOps.delete(gameRef);

    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      this.snapshot.clubs,
      this.snapshot.cities,
      this.snapshot.stadiums,
      matches,
      this.snapshot.staff,
      matchOps,
      this.snapshot.loadingRegistry,
    );
    this.listeners.forEach((listener) => listener());

    const home = clubDisplayName(match.homeClubId, this.snapshot.clubsById);
    const away = clubDisplayName(match.awayClubId, this.snapshot.clubsById);
    logActivity("match.deleted", `${home} × ${away} excluído(a).`);
  }

  /**
   * Replaces every "vencedor-<matchupId>" placeholder that just became
   * resolvable (see bracketResolution.ts) across the competition's matches —
   * called after every score edit and every new match so the fase
   * eliminatória's later rounds fill in on their own as results come in.
   */
  private async runBracketResolution(competitionId: string): Promise<void> {
    const competition = this.snapshot.competitions.find((item) => item.id === competitionId);
    if (!competition?.format) return;
    const matches = this.snapshot.matches.filter((item) => item.competitionId === competitionId);
    const patches = computeBracketResolutionPatches(competition.format, matches);
    for (const { gameRef, patch } of patches) {
      await this.applyMatchUpdate(gameRef, patch);
    }
  }

  private async applyMatchUpdate(gameRef: string, patch: Partial<Match>): Promise<void> {
    const index = this.snapshot.matches.findIndex((item) => buildGameRef(item) === gameRef);
    if (index === -1) throw new Error("Partida não encontrada.");

    const previous = this.snapshot.matches[index];
    const updated: Match = { ...previous, ...patch };
    const newGameRef = buildGameRef(updated);

    // Insert the new row first, then migrate FAFTV/Operação/Histórico off the
    // old gameRef (they FK-reference matches.id), and only then remove the
    // old row — removing it before the migration would violate those FKs.
    await this.matchRepo.update(previous, updated);
    if (newGameRef !== gameRef) {
      await this.migrateMatchOps(gameRef, newGameRef);
      await this.matchRepo.remove(gameRef);
    }

    const matches = [...this.snapshot.matches];
    matches[index] = updated;

    let matchOps: ReadonlyMap<string, MatchOperationsEntry> = this.snapshot.matchOps;
    if (newGameRef !== gameRef && matchOps.has(gameRef)) {
      const next = new Map(matchOps);
      const entry = next.get(gameRef)!;
      next.delete(gameRef);
      next.set(newGameRef, entry);
      matchOps = next;
    }

    this.snapshot = buildSnapshot(
      this.snapshot.competitions,
      this.snapshot.clubs,
      this.snapshot.cities,
      this.snapshot.stadiums,
      matches,
      this.snapshot.staff,
      matchOps,
      this.snapshot.loadingRegistry,
    );
    this.listeners.forEach((listener) => listener());

    const home = clubDisplayName(updated.homeClubId, this.snapshot.clubsById);
    const away = clubDisplayName(updated.awayClubId, this.snapshot.clubsById);
    logActivity("match.updated", `${home} × ${away} atualizado.`);
  }

  private async migrateMatchOps(oldGameRef: string, newGameRef: string): Promise<void> {
    const [faftv, operacao, history, faftvEscala, arbitragem, bordero, fafOficial] = await Promise.all([
      this.faftvRepo.get(oldGameRef),
      this.operacaoRepo.get(oldGameRef),
      this.historyRepo.listByGameRef(oldGameRef),
      this.faftvEscalaRepo.listByGameRefs([oldGameRef]),
      this.arbitragemRepo.get(oldGameRef),
      matchBorderoRepository.get(oldGameRef),
      matchFafOficialRepository.get(oldGameRef),
    ]);

    if (faftv) {
      await this.faftvRepo.upsert({ ...faftv, id: newGameRef, gameRef: newGameRef });
      await this.faftvRepo.remove(oldGameRef);
    }
    if (operacao) {
      await this.operacaoRepo.upsert({ ...operacao, id: newGameRef, gameRef: newGameRef });
      await this.operacaoRepo.remove(oldGameRef);
    }
    for (const entry of history) {
      await this.historyRepo.append({ ...entry, gameRef: newGameRef });
    }
    if (history.length > 0) {
      // Copies land under newGameRef above — without this, the old rows keep
      // FK-referencing the old match id and the remove() below (which deletes
      // that row) fails with a foreign-key violation, silently leaving a
      // duplicate fixture behind under the old date/time.
      await this.historyRepo.removeByGameRef(oldGameRef);
    }
    if (faftvEscala[0]) {
      await this.faftvEscalaRepo.upsert({ ...faftvEscala[0], id: newGameRef, gameRef: newGameRef });
      await this.faftvEscalaRepo.remove(oldGameRef);
    }
    if (arbitragem) {
      await this.arbitragemRepo.upsert({ ...arbitragem, id: newGameRef, gameRef: newGameRef });
      await this.arbitragemRepo.remove(oldGameRef);
    }
    if (bordero) {
      await matchBorderoRepository.upsert({ ...bordero, id: newGameRef, gameRef: newGameRef });
      await matchBorderoRepository.remove(oldGameRef);
    }
    if (fafOficial) {
      await matchFafOficialRepository.upsert({ ...fafOficial, id: newGameRef, gameRef: newGameRef });
      await matchFafOficialRepository.remove(oldGameRef);
    }
  }

  /**
   * Clears every FAFTV/Operação/Arbitragem/Escala/Histórico/Borderô/Oficial-
   * FAF row FK-referencing a match that is genuinely going away (not being
   * rescheduled — see migrateMatchOps for that case). Needed before the match
   * row itself can be deleted, since none of those tables cascade on delete.
   * Used when a reimport drops a fixture from the schedule and when a
   * competition is purged from the Lixeira.
   */
  private async cleanupMatchOps(gameRef: string): Promise<void> {
    await Promise.all([
      this.faftvRepo.remove(gameRef),
      this.operacaoRepo.remove(gameRef),
      this.historyRepo.removeByGameRef(gameRef),
      this.faftvEscalaRepo.remove(gameRef),
      this.arbitragemRepo.remove(gameRef),
      matchBorderoRepository.remove(gameRef),
      matchFafOficialRepository.remove(gameRef),
    ]);
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
      history = await this.recordHistory(
        gameRef,
        "faftv",
        `Status FAFTV alterado para "${faftvStatusLabel(updated.status)}"`,
        history,
      );
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
      history = await this.recordHistory(
        gameRef,
        "faftv",
        `Status FAFTV alterado para "${faftvStatusLabel(updated.status)}"`,
        history,
      );
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
    let history = await this.recordHistory(
      gameRef,
      "faftv",
      `Item "${label}" ${checked ? "concluído" : "reaberto"}`,
      entry.history,
    );
    if (updated.status !== entry.faftv.status) {
      history = await this.recordHistory(
        gameRef,
        "faftv",
        `Status FAFTV alterado para "${faftvStatusLabel(updated.status)}"`,
        history,
      );
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
    let history = await this.recordHistory(
      gameRef,
      "operacao",
      `Item "${label}" ${checked ? "concluído" : "reaberto"}`,
      entry.history,
    );
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
