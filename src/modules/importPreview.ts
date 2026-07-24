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
