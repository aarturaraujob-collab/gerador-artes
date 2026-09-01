import { slug, type DataStore, type ExtractedRow } from "./dataStore";

export interface UnmatchedEntities {
  clubs: string[];
  stadiums: string[];
  cities: string[];
}

function collectUnknown(names: Iterable<string>, known: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (!name) continue;
    const id = slug(name);
    if (known.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(name);
  }
  return result;
}

/**
 * Pure diff, no side effects: which club/stadium/city names in `rows` aren't
 * already registered in `store`. Mirrors exactly the same slugified-id
 * matching mergeMatches (dataStore.ts) uses when it auto-creates them — this
 * only decides what to show in a confirmation dialog beforehand, it never
 * creates anything itself.
 */
export function detectUnmatchedEntities(store: DataStore, rows: readonly ExtractedRow[]): UnmatchedEntities {
  const knownClubs = new Set(store.clubsById.keys());
  const knownStadiums = new Set(store.stadiumsById.keys());
  const knownCities = new Set(store.citiesById.keys());

  const clubNames = rows.flatMap((row) => [row.home, row.away]).filter((name): name is string => Boolean(name));
  const stadiumNames = rows.map((row) => row.stadium).filter((name): name is string => Boolean(name));
  const cityNames = rows.map((row) => row.city).filter((name): name is string => Boolean(name));

  return {
    clubs: collectUnknown(clubNames, knownClubs),
    stadiums: collectUnknown(stadiumNames, knownStadiums),
    cities: collectUnknown(cityNames, knownCities),
  };
}

export function hasUnmatchedEntities(entities: UnmatchedEntities): boolean {
  return entities.clubs.length > 0 || entities.stadiums.length > 0 || entities.cities.length > 0;
}

/**
 * "Nome que apareceu na planilha/FAF" → "id de um clube/estádio/cidade JÁ
 * cadastrado" — escolhido pelo usuário no UnmatchedEntitiesDialog em vez de
 * deixar mergeMatches cadastrar um registro novo. Vazio quando ninguém pediu
 * pra linkar nada (comportamento de sempre: tudo que não bate por slug() é
 * cadastrado como novo).
 */
export interface EntityAliases {
  clubs: Map<string, string>;
  stadiums: Map<string, string>;
  cities: Map<string, string>;
}

export function emptyEntityAliases(): EntityAliases {
  return { clubs: new Map(), stadiums: new Map(), cities: new Map() };
}

/**
 * Reescreve row.home/away/stadium/city pelo nome CANÔNICO do registro
 * escolhido em cada alias — como mergeMatches (dataStore.ts) decide o id de
 * cada entidade rodando slug() no nome da própria linha, trocar o nome pelo
 * nome do registro já cadastrado é o bastante pra linha "virar" aquele
 * registro em vez de criar um duplicado. Não precisa mexer em mergeMatches.
 */
export function applyEntityAliases(store: DataStore, rows: readonly ExtractedRow[], aliases: EntityAliases): ExtractedRow[] {
  if (aliases.clubs.size === 0 && aliases.stadiums.size === 0 && aliases.cities.size === 0) return [...rows];

  const resolve = (name: string | null, aliasMap: Map<string, string>, byId: ReadonlyMap<string, { shortName?: string; fullName?: string; name?: string }>) => {
    if (!name) return name;
    const targetId = aliasMap.get(name);
    if (!targetId) return name;
    const target = byId.get(targetId);
    return target ? (target.shortName ?? target.name ?? target.fullName ?? name) : name;
  };

  return rows.map((row) => ({
    ...row,
    home: resolve(row.home, aliases.clubs, store.clubsById),
    away: resolve(row.away, aliases.clubs, store.clubsById),
    stadium: resolve(row.stadium, aliases.stadiums, store.stadiumsById),
    city: resolve(row.city, aliases.cities, store.citiesById),
  }));
}
